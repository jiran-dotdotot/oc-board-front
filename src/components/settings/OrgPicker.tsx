import { useState } from 'react'

import { useTranslation } from 'react-i18next'

import { CheckMark } from '@/components/common/Checkbox'
import { ChevronDownIcon, OrgIcon, SearchIcon, XMini } from '@/components/common/icons'
import { useDepartments } from '@/hooks/useDepartments'
import type { OrgSelection } from '@/types/department'
import { type OrgMode, chipsOf, flattenOrg, toggleRow, totalOf } from '@/utils/orgTree'

/**
 * 조직도 피커 본체(정본 화면 09 `pkOpen` 블록).
 * - `modal` = 상세 패널이 여는 720px 모달 안쪽(좌 1fr / 우 270px · 높이 380px)
 * - `inline` = 추가 모달 안에 박히는 2단 박스(높이 200px)
 *
 * 선택은 호출부가 들고 있고(제어 컴포넌트) 이 컴포넌트는 조직도 조회·검색·펼침만 소유한다.
 * `scope` 모드는 부서를 **부서 grant 하나**로 담고, `admin` 모드는 부서 grant 가 없어
 * 소속 구성원 전체를 사용자 id 로 편다(정본 힌트와 같은 규칙 — `utils/orgTree.ts`).
 */
export function OrgPicker({
  mode,
  categoryId,
  value,
  onChange,
  variant = 'modal',
}: {
  mode: OrgMode
  /** 게시판·자료실은 상위 카테고리 범위로 조직도를 가지치기한다(빈값이면 전사). */
  categoryId: string | null
  value: OrgSelection
  onChange: (next: OrgSelection) => void
  variant?: 'modal' | 'inline'
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const { data: root, isPending, isError } = useDepartments(categoryId, true)

  // 루트는 처음부터 펼쳐 둔다 — 접힌 한 줄만 보이면 무엇을 고르는 화면인지 알 수 없다.
  const openSet = root && expanded.size === 0 ? new Set([root.id]) : expanded
  const rows = flattenOrg(root, { expanded: openSet, query, mode, selection: value })
  const chips = chipsOf(root, value, { all: t('admin-org-all') })
  const total = totalOf(root, value)
  // 좁은 화면에서는 두 칸이 세로로 쌓인다 — 380px 두 개면 폰 높이를 넘어 「확인」이 잘린다.
  const paneH = variant === 'modal' ? 'h-[380px] max-[630px]:h-[38dvh]' : 'h-[200px]'

  const toggleExpand = (id: number) => {
    const next = new Set(openSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  const search = (
    <span className="relative block flex-none p-2.5 pb-1">
      <SearchIcon className="absolute top-[19px] left-[21px] size-3.5 text-gray-400" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('admin-org-search')}
        aria-label={t('admin-org-search')}
        className="h-[34px] w-full rounded-lg border border-gray-200 bg-gray-50 pr-2.5 pl-[34px] text-xs focus:border-primary focus:bg-card focus:outline-none"
      />
    </span>
  )

  const tree = (
    <div
      role="tree"
      aria-label={t(mode === 'admin' ? 'admin-org-title-admin' : 'admin-org-title-scope')}
      className="flex flex-1 flex-col gap-px overflow-y-auto px-1.5 pb-2"
    >
      {isPending && <span className="p-4 text-s text-gray-400">{t('admin-org-loading')}</span>}
      {isError && <span className="p-4 text-s text-destructive">{t('admin-org-error')}</span>}
      {!isPending && !isError && rows.length === 0 && (
        <span className="p-4 text-s text-gray-400">{t('admin-search-none')}</span>
      )}
      {rows.map((r) => (
        <span
          key={r.key}
          role="none"
          className="flex items-center"
          style={{ paddingLeft: 8 + r.depth * 15 }}
        >
          {r.hasKids ? (
            <button
              type="button"
              aria-label={t('admin-org-expand', { name: r.name })}
              aria-expanded={r.expanded}
              onClick={() => toggleExpand(r.id)}
              className="flex size-[13px] flex-none items-center justify-center text-gray-400"
            >
              <ChevronDownIcon
                className={[
                  'size-[13px] transition-transform',
                  r.expanded ? '' : '-rotate-90',
                ].join(' ')}
              />
            </button>
          ) : (
            <span className="w-[13px] flex-none" />
          )}
          <button
            type="button"
            role="treeitem"
            aria-level={r.depth + 1}
            aria-checked={r.on ? true : r.mixed ? 'mixed' : false}
            aria-expanded={r.hasKids ? r.expanded : undefined}
            aria-disabled={r.locked || undefined}
            disabled={r.locked}
            onClick={() => root && onChange(toggleRow(root, r, value, mode))}
            className="flex min-h-[28px] min-w-0 flex-1 items-center gap-[7px] rounded px-2 py-px text-left hover:bg-gray-50 disabled:cursor-default disabled:opacity-60"
          >
            <CheckMark checked={r.on} mixed={r.mixed} />
            {r.kind === 'user' && (
              <span className="inline-flex size-[22px] flex-none items-center justify-center rounded-full bg-l-blue text-[10.5px] font-bold text-on-pastel">
                {Array.from(r.name)[0] ?? '?'}
              </span>
            )}
            <span className="truncate text-s text-gray-800">{r.name}</span>
            {r.sub && <span className="flex-none text-xs text-gray-400">· {r.sub}</span>}
            {r.count !== undefined && (
              <span className="ml-auto flex-none text-xs text-gray-400">{r.count}</span>
            )}
          </button>
        </span>
      ))}
    </div>
  )

  const selected = (
    <div className={['flex flex-col', paneH].join(' ')}>
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2.5">
        {chips.length === 0 ? (
          <span className="px-2 py-6 text-center text-xs text-gray-400">
            {t('admin-org-empty')}
          </span>
        ) : (
          chips.map((c) => (
            <span
              key={c.key}
              className="flex items-center gap-[9px] rounded-lg p-1.5 hover:bg-gray-50"
            >
              <span className="inline-flex size-[30px] flex-none items-center justify-center rounded-full bg-l-blue text-xs font-bold text-on-pastel">
                {c.kind === 'dept' ? (
                  <OrgIcon className="size-3.5 text-primary" />
                ) : (
                  (Array.from(c.name)[0] ?? '?')
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="truncate text-s font-semibold text-gray-900">{c.name}</span>
                <span className="truncate text-2xs text-gray-400">{c.sub}</span>
              </span>
              <button
                type="button"
                aria-label={`${c.name} ${t('admin-org-deselect')}`}
                onClick={() =>
                  onChange(
                    c.kind === 'dept'
                      ? { ...value, departmentIds: value.departmentIds.filter((id) => id !== c.id) }
                      : { ...value, userIds: value.userIds.filter((id) => id !== c.id) },
                  )
                }
                className="inline-flex size-6 flex-none items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-destructive"
              >
                <XMini />
              </button>
            </span>
          ))
        )}
      </div>
      <div className="flex flex-none items-center gap-2 border-t border-gray-100 px-3 py-2.5">
        <span aria-live="polite" className="text-s text-gray-600">
          {t('admin-org-total', { n: total })}
        </span>
        <button
          type="button"
          disabled={chips.length === 0}
          onClick={() => onChange({ departmentIds: [], userIds: [] })}
          className="ml-auto inline-flex h-[30px] items-center rounded-lg border border-gray-200 bg-card px-[11px] text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-40"
        >
          {t('admin-org-reset')}
        </button>
      </div>
    </div>
  )

  if (variant === 'inline') {
    return (
      <div className="flex w-full flex-col gap-2 rounded-lg border border-gray-200 p-2.5">
        {search}
        <div className="grid grid-cols-2 gap-2 max-[630px]:grid-cols-1">
          <div className={['flex flex-col rounded-lg border border-gray-100', paneH].join(' ')}>
            {tree}
          </div>
          <div className="rounded-lg border border-gray-100">{selected}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_270px] max-[630px]:grid-cols-1">
      <div className={['flex flex-col border-r border-gray-100', paneH].join(' ')}>
        {search}
        {tree}
      </div>
      {selected}
    </div>
  )
}
