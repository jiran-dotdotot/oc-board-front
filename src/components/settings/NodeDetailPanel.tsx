import { useState } from 'react'

import { useTranslation } from 'react-i18next'

import { OrgPickerModal } from './OrgPickerModal'
import {
  BTYPE_KEY,
  BTYPE_OPTIONS,
  FILE_MAX_OPTS,
  NAME_MAX,
  TOTAL_MAX_OPTS,
  TYPE_KEY,
} from './constants'
import type { NodeDraft, ScopeMode, SettingsNode } from './types'
import { CapChip, RadioRow, Section } from './ui'
import { Switch } from '@/components/common/Switch'
import { OrgIcon, PlusMini, TrashIcon, XMini } from '@/components/common/icons'
import { fmtSize } from '@/components/drive/driveData'
import type { BoardDetail, CategoryDetail } from '@/types/category'
import type { OrgSelection } from '@/types/department'
import { draftOf } from '@/utils/settingsPayload'
import { bytesToLabel, capOptions, labelToBytes } from '@/utils/settingsTree'

/**
 * 우측 상세 패널. 이름·공개범위·관리자는 4종 공통이고 게시판은 타입·알림·사용여부,
 * 자료실은 용량·확장자·알림이 붙는다(정본 화면 09 L200-230).
 *
 * 공개 범위·관리자는 조직도 피커로 고른다. 이름·설정과 달리 **저장 버튼을 거치지 않고**
 * 피커의 「확인」에서 바로 반영된다 — 기존 제거 동작(즉시 PUT)과 같은 규칙이다.
 */
export function NodeDetailPanel({
  node,
  detail,
  meName,
  saving,
  scopeMode,
  orgCategoryId,
  onSave,
  onDelete,
  onScopeMode,
  onScopeSelection,
  onAdmins,
}: {
  node: SettingsNode
  detail: BoardDetail | CategoryDetail | undefined
  meName: string
  saving: boolean
  /** 전체 공개 / 조직 지정. 서버 값에 「지금 고른 값」을 얹어 호출부가 정한다. */
  scopeMode: ScopeMode
  /** 조직도를 가지치기할 상위 카테고리(없으면 전사). */
  orgCategoryId: string | null
  onSave: (draft: NodeDraft) => void
  onDelete: () => void
  onScopeMode: (next: ScopeMode) => void
  onScopeSelection: (next: OrgSelection) => void
  onAdmins: (next: number[]) => void
}) {
  const { t } = useTranslation()
  const [extInput, setExtInput] = useState('')
  const [picker, setPicker] = useState<'scope' | 'admin' | null>(null)

  // 노드가 바뀌면 초안을 그 노드의 값으로 다시 시작한다.
  // effect 로 되돌리면 옛 초안이 한 프레임 그려진다 → 렌더 중 파생(React 공식 패턴).
  const key = `${node.kind}:${node.id}`
  const [state, setState] = useState({ key, draft: draftOf(node) })
  if (state.key !== key) setState({ key, draft: draftOf(node) })
  const draft = state.key === key ? state.draft : draftOf(node)
  const patch = (p: Partial<NodeDraft>) => setState({ key, draft: { ...draft, ...p } })

  const isDrive = node.kind === 'drive'
  const isBoard = node.kind === 'board'
  const readOnly = !node.canManage || !!node.fixed
  const usage = detail && 'total_usage_size' in detail ? detail.total_usage_size : 0

  const admins = grantsOf(detail, 'admin')
  const members = grantsOf(detail, 'member')
  const departments = departmentsOf(detail)
  const selection: OrgSelection = {
    departmentIds: departments.map((d) => d.id),
    userIds: members.map((u) => u.id),
  }
  // 트리거 라벨. 총 인원수는 부서 인원을 모르는 상태라 피커 안(총 N명)에서만 보여 준다.
  const first = departments[0]?.name ?? members[0]?.name ?? ''
  const rest = departments.length + members.length - 1
  const scopeLabel = !first
    ? t('admin-org-pick')
    : rest > 0
      ? t('admin-org-pick-more', { name: first, n: rest })
      : t('admin-org-pick-one', { name: first })

  const addExt = () => {
    const v = extInput.trim()
    if (!v || draft.except_extension.includes(v)) return
    patch({ except_extension: [...draft.except_extension, v] })
    setExtInput('')
  }

  return (
    <div className="flex flex-col gap-[18px] rounded-lg border border-gray-200 bg-card px-[22px] py-5">
      {/* 이름 + 삭제 */}
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex h-[22px] flex-none items-center rounded bg-l-blue px-2 text-2xs font-bold text-on-pastel">
          {t(TYPE_KEY[node.kind])}
        </span>
        <input
          value={draft.name}
          aria-label={t('admin-name-suffix')}
          disabled={readOnly}
          onChange={(e) => patch({ name: Array.from(e.target.value).slice(0, NAME_MAX).join('') })}
          className="h-10 w-[250px] max-w-full rounded-md border border-gray-300 bg-card px-3 text-sm font-semibold focus:border-primary focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
        />
        {node.fixed ? (
          <span className="text-xs text-gray-400">{t('admin-fixed-note')}</span>
        ) : (
          node.canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 px-3 text-s font-semibold text-destructive hover:bg-destructive-bg"
            >
              <TrashIcon className="size-3" /> {t('common-delete')}
            </button>
          )
        )}
        {readOnly && !node.fixed && (
          <span className="text-xs text-gray-400">{t('admin-readonly')}</span>
        )}
      </div>

      {/* 공개 범위 — 정본 라디오 + 조직 지정일 때만 피커 트리거 */}
      <Section title={t('admin-scope')}>
        {node.fixed ? (
          <span className="text-s text-gray-500">{t('admin-fixed-scope-note')}</span>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-[18px]">
              <div
                role="radiogroup"
                aria-label={t('admin-scope')}
                className="flex flex-wrap items-center gap-[18px]"
              >
                <RadioRow
                  label={t('admin-scope-all')}
                  on={scopeMode === 'all'}
                  onClick={() => onScopeMode('all')}
                  disabled={readOnly}
                />
                <RadioRow
                  label={t('admin-scope-org')}
                  on={scopeMode === 'org'}
                  onClick={() => onScopeMode('org')}
                  disabled={readOnly}
                />
              </div>
              {scopeMode === 'org' && (
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => setPicker('scope')}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-card px-3 text-s font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  <OrgIcon className="size-3.5 text-primary" />
                  {scopeLabel}
                </button>
              )}
            </div>
            <span className="text-xs text-gray-400">{t('admin-scope-sub-hint')}</span>
          </>
        )}
      </Section>

      {/* 관리자 — 본인 칩은 제거할 수 없다(정본). 추가는 피커 admin 모드. */}
      {!node.fixed && (
        <Section title={t('admin-managers')}>
          <div className="flex flex-wrap items-center gap-2">
            <GrantChip name={meName} suffix={t('admin-me')} tone="blue" />
            {admins.map((u) => (
              <GrantChip
                key={`a${u.id}`}
                name={u.name}
                tone="green"
                onRemove={
                  readOnly
                    ? undefined
                    : () => onAdmins(admins.filter((a) => a.id !== u.id).map((a) => a.id))
                }
              />
            ))}
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setPicker('admin')}
              className="inline-flex h-8 items-center gap-1.5 rounded-2xl border border-dashed border-gray-300 px-[13px] text-s font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            >
              <PlusMini /> {t('admin-add-manager')}
            </button>
          </div>
        </Section>
      )}

      {/* 게시판 설정 */}
      {isBoard && (
        <Section title={t('admin-board-settings')}>
          <div className="flex flex-wrap items-center gap-[18px]">
            <FieldLabel>{t('admin-type')}</FieldLabel>
            <div
              role="radiogroup"
              aria-label={t('admin-type')}
              className="flex flex-wrap items-center gap-[18px]"
            >
              {BTYPE_OPTIONS.map((bt) => (
                <RadioRow
                  key={bt}
                  label={t(BTYPE_KEY[bt])}
                  on={draft.type === bt}
                  disabled={readOnly}
                  onClick={() => patch({ type: bt })}
                />
              ))}
            </div>
          </div>
          <AlarmRow draft={draft} patch={patch} readOnly={readOnly} label={t('admin-alarm-new')} />
          <div className="flex items-center gap-[18px]">
            <FieldLabel>{t('admin-active')}</FieldLabel>
            <Switch
              on={draft.is_active}
              label={t('admin-active')}
              disabled={readOnly}
              onClick={() => patch({ is_active: !draft.is_active })}
            />
            <span className="text-xs text-gray-400">{t('admin-active-hint')}</span>
          </div>
        </Section>
      )}

      {/* 자료실 설정 */}
      {isDrive && (
        <Section title={t('admin-drive-settings')}>
          <QuotaRow
            label={t('admin-file-max')}
            current={draft.size_limit_per_file}
            presets={FILE_MAX_OPTS}
            readOnly={readOnly}
            onPick={(bytes) => patch({ size_limit_per_file: bytes })}
          />
          <QuotaRow
            label={t('admin-total-max')}
            current={draft.size_limit}
            presets={TOTAL_MAX_OPTS}
            readOnly={readOnly}
            onPick={(bytes) => patch({ size_limit: bytes })}
            note={usage > 0 ? t('admin-drive-usage', { used: fmtSize(usage) }) : undefined}
          />
          <div className="flex flex-wrap items-start gap-3">
            <FieldLabel wide className="pt-1.5">
              {t('admin-ext-block')}
            </FieldLabel>
            <div className="flex min-w-[200px] flex-1 flex-wrap items-center gap-1.5">
              {draft.except_extension.map((x) => (
                <span
                  key={x}
                  className="inline-flex h-[26px] items-center gap-1 rounded-2xl bg-l-gray pr-1 pl-2.5 text-xs font-semibold text-on-pastel"
                >
                  {/* 서버는 대문자로 저장·반환한다. 표시만 소문자로 맞춘다(정본 `.exe`). */}.
                  {x.toLowerCase()}
                  {!readOnly && (
                    <button
                      type="button"
                      aria-label={`${x} ${t('common-delete')}`}
                      onClick={() =>
                        patch({ except_extension: draft.except_extension.filter((y) => y !== x) })
                      }
                      className="inline-flex size-[18px] items-center justify-center rounded-full text-gray-400 hover:text-destructive"
                    >
                      <XMini />
                    </button>
                  )}
                </span>
              ))}
              {!readOnly && (
                <>
                  <input
                    value={extInput}
                    aria-label={t('admin-ext-block')}
                    onChange={(e) =>
                      setExtInput(e.target.value.replace(/[^a-z0-9]/gi, '').toLowerCase())
                    }
                    onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && addExt()}
                    placeholder="exe"
                    className="h-7 w-[70px] rounded-md border border-gray-300 bg-card px-2.5 text-xs focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addExt}
                    className="inline-flex h-7 items-center rounded-md bg-gray-100 px-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                  >
                    {t('admin-add')}
                  </button>
                </>
              )}
            </div>
          </div>
          <AlarmRow
            draft={draft}
            patch={patch}
            readOnly={readOnly}
            label={t('admin-drive-alarm')}
            wide
          />
        </Section>
      )}

      {/* 저장 */}
      {!readOnly && (
        <div className="flex justify-end border-t border-gray-100 pt-3.5">
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(draft)}
            className="inline-flex h-10 items-center rounded-md bg-primary px-[18px] text-sm font-semibold text-white hover:bg-ov-blue-700 disabled:opacity-40"
          >
            {t('common-save')}
          </button>
        </div>
      )}

      {picker && (
        <OrgPickerModal
          mode={picker === 'admin' ? 'admin' : 'scope'}
          categoryId={orgCategoryId}
          initial={
            picker === 'admin' ? { departmentIds: [], userIds: admins.map((a) => a.id) } : selection
          }
          onClose={() => setPicker(null)}
          onConfirm={(next) => {
            setPicker(null)
            if (picker === 'admin') onAdmins(next.userIds)
            else onScopeSelection(next)
          }}
        />
      )}
    </div>
  )
}

function AlarmRow({
  draft,
  patch,
  readOnly,
  label,
  wide,
}: {
  draft: NodeDraft
  patch: (p: Partial<NodeDraft>) => void
  readOnly: boolean
  label: string
  wide?: boolean
}) {
  return (
    <div className="flex items-center gap-[18px]">
      <FieldLabel wide={wide}>{label}</FieldLabel>
      <Switch
        on={draft.is_post_alarm}
        label={label}
        disabled={readOnly}
        onClick={() => patch({ is_post_alarm: !draft.is_post_alarm })}
      />
    </div>
  )
}

/** 용량 칩 한 줄. 정본 칩에 없는 기존 값은 칩으로 덧붙여 조용히 바뀌는 것을 막는다. */
function QuotaRow({
  label,
  current,
  presets,
  readOnly,
  onPick,
  note,
}: {
  label: string
  current: number | null
  presets: string[]
  readOnly: boolean
  onPick: (bytes: number | null) => void
  note?: string
}) {
  const options = capOptions(current, presets)
  const currentLabel = current != null && current > 0 ? bytesToLabel(current) : null
  return (
    <div className="flex flex-wrap items-center gap-3">
      <FieldLabel wide>{label}</FieldLabel>
      {options.map((v) => (
        <CapChip
          key={v}
          label={v}
          on={currentLabel === v}
          onClick={() => !readOnly && onPick(labelToBytes(v))}
        />
      ))}
      {note && <span className="text-xs text-gray-400">{note}</span>}
    </div>
  )
}

function FieldLabel({
  children,
  wide,
  className = '',
}: {
  children: React.ReactNode
  wide?: boolean
  className?: string
}) {
  return (
    <span
      className={`${wide ? 'w-[110px]' : 'w-[70px]'} flex-none text-s text-gray-500 ${className}`}
    >
      {children}
    </span>
  )
}

function GrantChip({
  name,
  suffix,
  tone,
  onRemove,
}: {
  name: string
  suffix?: string
  tone: 'blue' | 'green' | 'gray'
  onRemove?: () => void
}) {
  const { t } = useTranslation()
  const bg = tone === 'blue' ? 'bg-l-blue' : tone === 'green' ? 'bg-l-green' : 'bg-l-gray'
  return (
    <span className="inline-flex h-8 items-center gap-[7px] rounded-2xl bg-gray-50 pr-2 pl-1.5">
      <span
        className={`inline-flex size-6 items-center justify-center rounded-full text-2xs font-bold text-on-pastel ${bg}`}
      >
        {name.slice(0, 1)}
      </span>
      <span className="text-s text-gray-700">{suffix ? `${name} (${suffix})` : name}</span>
      {onRemove ? (
        <button
          type="button"
          aria-label={`${name} ${t('common-delete')}`}
          onClick={onRemove}
          className="inline-flex size-[18px] items-center justify-center rounded-full text-gray-400 hover:text-destructive"
        >
          <XMini />
        </button>
      ) : (
        <span className="w-1" />
      )}
    </span>
  )
}

/* grant 는 게시판·카테고리가 키 이름만 다르다. 사용자가 삭제된 경우 `user` 는 null 이지만
   grant 행은 남아 «철회 대상»으로 쓸 수 있어 id 로 이름을 대신한다. */
function grantsOf(
  detail: BoardDetail | CategoryDetail | undefined,
  which: 'admin' | 'member',
): { id: number; name: string }[] {
  if (!detail) return []
  const list =
    'board_admins' in detail
      ? which === 'admin'
        ? detail.board_admins
        : detail.board_members
      : which === 'admin'
        ? detail.category_admins
        : detail.category_members
  return list.map((g) => ({ id: g.user_id, name: g.user?.name ?? `#${g.user_id}` }))
}

function departmentsOf(
  detail: BoardDetail | CategoryDetail | undefined,
): { id: number; name: string }[] {
  if (!detail) return []
  const list =
    'board_departments' in detail ? detail.board_departments : detail.category_departments
  return list.map((g) => ({
    id: g.department_id,
    name: g.department?.name ?? `#${g.department_id}`,
  }))
}
