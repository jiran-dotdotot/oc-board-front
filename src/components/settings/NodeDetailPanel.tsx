import { useState } from 'react'

import { useTranslation } from 'react-i18next'

import {
  BTYPE_KEY,
  BTYPE_OPTIONS,
  FILE_MAX_OPTS,
  NAME_MAX,
  TOTAL_MAX_OPTS,
  TYPE_KEY,
} from './constants'
import type { BType, Cat, Folder, Item, NodeKind } from './types'
import { CapChip, RadioRow, Section } from './ui'
import { Switch } from '@/components/common/Switch'
import { PersonIcon, PlusMini, TrashIcon, XMini } from '@/components/common/icons'

type Selected = Cat | Folder | Item

/**
 * 우측 상세 패널. 이름·공개범위·관리자는 4종 공통이고 게시판은 타입·알림·사용여부,
 * 자료실은 용량·확장자·알림이 붙는다(정본 web:1265-1339).
 */
export function NodeDetailPanel({
  node,
  kind,
  item,
  admins,
  meName,
  onPatch,
  onOpenScopePicker,
  onOpenAdminPicker,
  onDelete,
  onSave,
}: {
  node: Selected
  kind: NodeKind
  item: Item | null
  admins: string[]
  /** 본인 칩에 쓰는 이름. `useMe()` 값이며, 없으면 호출자가 빈 문자열을 준다. */
  meName: string
  onPatch: (patch: Partial<Cat & Folder & Item>) => void
  onOpenScopePicker: () => void
  onOpenAdminPicker: () => void
  onDelete: () => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  const [extInput, setExtInput] = useState('')
  const isFixed = 'fixed' in node && node.fixed

  const addExt = () => {
    const v = extInput.trim()
    if (!v || (item?.exts ?? []).includes(v)) return
    onPatch({ exts: [...(item?.exts ?? []), v] })
    setExtInput('')
  }

  return (
    <div className="flex flex-col gap-[18px] rounded-lg border border-gray-200 bg-card px-[22px] py-5">
      {/* 이름 + 삭제 */}
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex h-[22px] flex-none items-center rounded bg-l-blue px-2 text-2xs font-bold text-on-pastel">
          {t(TYPE_KEY[kind])}
        </span>
        <input
          value={node.name}
          aria-label={t('admin-name-suffix')}
          onChange={(e) =>
            onPatch({ name: Array.from(e.target.value).slice(0, NAME_MAX).join('') })
          }
          className="h-10 w-[250px] max-w-full rounded-md border border-gray-300 bg-card px-3 text-sm font-semibold focus:border-primary focus:outline-none"
        />
        {isFixed ? (
          <span className="text-xs text-gray-400">{t('admin-fixed-note')}</span>
        ) : (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 px-3 text-s font-semibold text-destructive hover:bg-destructive-bg"
          >
            <TrashIcon className="size-3" /> {t('common-delete')}
          </button>
        )}
      </div>

      {/* 공개 범위 */}
      <Section title={t('admin-scope')}>
        {isFixed ? (
          <span className="text-s text-gray-500">{t('admin-fixed-scope-note')}</span>
        ) : (
          <>
            <div
              role="radiogroup"
              aria-label={t('admin-scope')}
              className="flex flex-wrap items-center gap-[18px]"
            >
              <RadioRow
                label={t('admin-scope-all')}
                on={node.scope === 'all'}
                onClick={() => onPatch({ scope: 'all' })}
              />
              <RadioRow
                label={t('admin-scope-org')}
                on={node.scope === 'org'}
                onClick={() => onPatch({ scope: 'org' })}
              />
              {node.scope === 'org' && (
                <button
                  type="button"
                  onClick={onOpenScopePicker}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-card px-3 text-s font-semibold text-gray-700 hover:bg-gray-100"
                >
                  <PersonIcon /> {node.scopeLabel || t('admin-scope-default')}
                </button>
              )}
            </div>
            <span className="text-xs text-gray-400">{t('admin-scope-hint')}</span>
          </>
        )}
      </Section>

      {/* 관리자 */}
      <Section title={t('admin-managers')}>
        <div className="flex flex-wrap items-center gap-2">
          {/* 본인 칩 — 정본은 「이름 (나)」로 고정 노출한다(web:1287). */}
          <AdminChip name={meName} suffix={t('admin-me')} tone="blue" />
          {admins.map((name) => (
            <AdminChip
              key={name}
              name={name}
              tone="green"
              onRemove={() => onPatch({ admins: admins.filter((n) => n !== name) })}
            />
          ))}
          <button
            type="button"
            onClick={onOpenAdminPicker}
            className="inline-flex h-8 items-center gap-1.5 rounded-2xl border border-dashed border-gray-300 px-[13px] text-s font-semibold text-gray-500 hover:bg-gray-100"
          >
            <PlusMini /> {t('admin-add-manager')}
          </button>
        </div>
        <span className="text-xs text-gray-400">{t('admin-managers-hint')}</span>
      </Section>

      {/* 게시판 설정 */}
      {kind === 'board' && item && (
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
                  on={item.btype === bt}
                  onClick={() => onPatch({ btype: bt as BType })}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-[18px]">
            <FieldLabel>{t('admin-alarm-new')}</FieldLabel>
            <Switch
              on={!!item.alarm}
              label={t('admin-alarm-new')}
              onClick={() => onPatch({ alarm: !item.alarm })}
            />
          </div>
          <div className="flex items-center gap-[18px]">
            <FieldLabel>{t('admin-active')}</FieldLabel>
            <Switch
              on={item.active}
              label={t('admin-active')}
              onClick={() => onPatch({ active: !item.active })}
            />
            <span className="text-xs text-gray-400">{t('admin-active-hint')}</span>
          </div>
        </Section>
      )}

      {/* 자료실 설정 */}
      {kind === 'drive' && item && (
        <Section title={t('admin-drive-settings')}>
          <div className="flex flex-wrap items-center gap-3">
            <FieldLabel wide>{t('admin-file-max')}</FieldLabel>
            {FILE_MAX_OPTS.map((v) => (
              <CapChip
                key={v}
                label={v}
                on={item.fileMax === v}
                onClick={() => onPatch({ fileMax: v })}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <FieldLabel wide>{t('admin-total-max')}</FieldLabel>
            {TOTAL_MAX_OPTS.map((v) => (
              <CapChip
                key={v}
                label={v}
                on={item.totalMax === v}
                onClick={() => onPatch({ totalMax: v })}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <FieldLabel wide className="pt-1.5">
              {t('admin-ext-block')}
            </FieldLabel>
            <div className="flex min-w-[200px] flex-1 flex-wrap items-center gap-1.5">
              {(item.exts ?? []).map((x, i) => (
                <span
                  key={x}
                  className="inline-flex h-[26px] items-center gap-1 rounded-2xl bg-l-gray pr-1 pl-2.5 text-xs font-semibold text-on-pastel"
                >
                  .{x}
                  <button
                    type="button"
                    aria-label={`${x} ${t('common-delete')}`}
                    onClick={() => onPatch({ exts: (item.exts ?? []).filter((_, j) => j !== i) })}
                    className="inline-flex size-[18px] items-center justify-center rounded-full text-gray-400 hover:text-destructive"
                  >
                    <XMini />
                  </button>
                </span>
              ))}
              <input
                value={extInput}
                aria-label={t('admin-ext-block')}
                onChange={(e) =>
                  setExtInput(e.target.value.replace(/[^a-z0-9]/gi, '').toLowerCase())
                }
                onKeyDown={(e) => e.key === 'Enter' && addExt()}
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
            </div>
          </div>
          <div className="flex items-center gap-3">
            <FieldLabel wide>{t('admin-drive-alarm')}</FieldLabel>
            <Switch
              on={!!item.alarm}
              label={t('admin-drive-alarm')}
              onClick={() => onPatch({ alarm: !item.alarm })}
            />
          </div>
        </Section>
      )}

      {/* 저장 */}
      <div className="flex justify-end border-t border-gray-100 pt-3.5">
        <button
          type="button"
          onClick={onSave}
          className="inline-flex h-10 items-center rounded-md bg-primary px-[18px] text-sm font-semibold text-white hover:bg-ov-blue-700"
        >
          {t('common-save')}
        </button>
      </div>
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

function AdminChip({
  name,
  suffix,
  tone,
  onRemove,
}: {
  name: string
  suffix?: string
  tone: 'blue' | 'green'
  onRemove?: () => void
}) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex h-8 items-center gap-[7px] rounded-2xl bg-gray-50 pr-2 pl-1.5">
      <span
        className={`inline-flex size-6 items-center justify-center rounded-full text-2xs font-bold text-on-pastel ${
          tone === 'blue' ? 'bg-l-blue' : 'bg-l-green'
        }`}
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
