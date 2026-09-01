import { useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'

import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { ORG, countUnder, isTeam, orgById, orgKids, teamsUnder } from '@/components/settings/treeData'

export type PickerMode = 'scope' | 'admin'

export interface PickerResult {
  names: string[]
  label: string
  total: number
}

interface Person {
  n: string
  t: string
}

interface Row {
  key: string
  isPerson: boolean
  isRoot: boolean
  name: string
  count?: number
  ini: string
  depth: number
  hasKids: boolean
  expanded: boolean
  on: boolean
  mixed: boolean
  onToggle: () => void
  onExpand: () => void
}

export function OrgPickerModal({
  open,
  mode,
  onClose,
  onConfirm,
}: {
  open: boolean
  mode: PickerMode
  onClose: () => void
  onConfirm: (r: PickerResult) => void
}) {
  // 이 컴포넌트는 열려 있을 때만 렌더된다 → 항상 잠금(중첩은 참조 카운팅)
  useBodyScrollLock(true)
  const { t } = useTranslation()
  const [teamsSel, setTeamsSel] = useState<string[]>([])
  const [peopleSel, setPeopleSel] = useState<Person[]>([])
  const [exp, setExp] = useState<Record<string, boolean>>({ co: true })
  const [query, setQuery] = useState('')

  // 열릴 때마다 부모가 조건부 마운트하므로 초기 state가 곧 초기화

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const toggleTeams = (ts: string[], on: boolean) => {
    if (on) setTeamsSel((prev) => prev.filter((x) => !ts.includes(x)))
    else {
      setTeamsSel((prev) => prev.concat(ts.filter((x) => !prev.includes(x))))
      setPeopleSel((prev) => prev.filter((p) => !ts.includes(p.t)))
    }
  }
  const togglePerson = (m: string, teamId: string, on: boolean) => {
    if (teamsSel.includes(teamId)) return
    setPeopleSel((prev) =>
      on ? prev.filter((p) => !(p.n === m && p.t === teamId)) : prev.concat([{ n: m, t: teamId }]),
    )
  }

  // 행 목록 구성
  const rows: Row[] = []
  const q = query.trim()
  if (q) {
    ORG.filter(isTeam).forEach((team) => {
      const parentName = orgById(team.parent ?? '')?.name ?? ''
      const tOn = teamsSel.includes(team.id)
      const tMixed = !tOn && peopleSel.some((p) => p.t === team.id)
      if (team.name.includes(q)) {
        rows.push({
          key: `t-${team.id}`,
          isPerson: false,
          isRoot: false,
          name: `${team.name} · ${parentName}`,
          count: team.count,
          ini: '',
          depth: 0,
          hasKids: false,
          expanded: false,
          on: tOn,
          mixed: tMixed,
          onToggle: () => toggleTeams([team.id], tOn),
          onExpand: () => {},
        })
      }
      ;(team.members ?? []).forEach((m) => {
        if (!m.includes(q)) return
        const inTeam = teamsSel.includes(team.id)
        const pOn = inTeam || peopleSel.some((p) => p.n === m && p.t === team.id)
        rows.push({
          key: `p-${team.id}-${m}`,
          isPerson: true,
          isRoot: false,
          name: `${m} · ${team.name}`,
          ini: m[0],
          depth: 0,
          hasKids: false,
          expanded: false,
          on: pOn,
          mixed: false,
          onToggle: () => togglePerson(m, team.id, pOn),
          onExpand: () => {},
        })
      })
    })
  } else {
    const walk = (id: string, depth: number) => {
      const n = orgById(id)
      if (!n) return
      const team = isTeam(n)
      const ts = teamsUnder(id)
      const on = ts.length > 0 && ts.every((x) => teamsSel.includes(x))
      const mixed =
        !on && (ts.some((x) => teamsSel.includes(x)) || peopleSel.some((p) => ts.includes(p.t)))
      const expanded = !!exp[id]
      const hasKids = team ? (n.members ?? []).length > 0 : orgKids(id).length > 0
      rows.push({
        key: id,
        isPerson: false,
        isRoot: id === 'co',
        name: n.name,
        count: team ? n.count : countUnder(id),
        ini: '',
        depth,
        hasKids,
        expanded,
        on,
        mixed,
        onToggle: () => toggleTeams(ts, on),
        onExpand: () => setExp((prev) => ({ ...prev, [id]: !expanded })),
      })
      if (expanded) {
        if (team) {
          ;(n.members ?? []).forEach((m) => {
            const inTeam = teamsSel.includes(id)
            const pOn = inTeam || peopleSel.some((p) => p.n === m && p.t === id)
            rows.push({
              key: `p-${id}-${m}`,
              isPerson: true,
              isRoot: false,
              name: m,
              ini: m[0],
              depth: depth + 1,
              hasKids: false,
              expanded: false,
              on: pOn,
              mixed: false,
              onToggle: () => togglePerson(m, id, pOn),
              onExpand: () => {},
            })
          })
        } else {
          orgKids(id).forEach((k) => walk(k.id, depth + 1))
        }
      }
    }
    walk('co', 0)
  }

  // 선택 칩 집계
  const chips: {
    key: string
    name: string
    sub: string
    isOrg: boolean
    ini: string
    remove: () => void
  }[] = []
  const coTeams = teamsUnder('co')
  if (coTeams.length > 0 && coTeams.every((x) => teamsSel.includes(x))) {
    chips.push({
      key: 'co',
      name: '오피스웨이브TF',
      sub: t('admin-pk-all'),
      isOrg: true,
      ini: '',
      remove: () => setTeamsSel((prev) => prev.filter((x) => !coTeams.includes(x))),
    })
  } else {
    orgKids('co').forEach((k) => {
      const ts = teamsUnder(k.id)
      if (ts.length > 0 && ts.every((x) => teamsSel.includes(x))) {
        chips.push({
          key: k.id,
          name: k.name,
          sub: '오피스웨이브TF',
          isOrg: true,
          ini: '',
          remove: () => setTeamsSel((prev) => prev.filter((x) => !ts.includes(x))),
        })
      } else {
        ts.filter((x) => teamsSel.includes(x)).forEach((tid) => {
          const tn = orgById(tid)
          chips.push({
            key: tid,
            name: tn?.name ?? '',
            sub: k.name,
            isOrg: true,
            ini: '',
            remove: () => setTeamsSel((prev) => prev.filter((x) => x !== tid)),
          })
        })
      }
    })
  }
  peopleSel.forEach((p) => {
    chips.push({
      key: `p-${p.t}-${p.n}`,
      name: p.n,
      sub: orgById(p.t)?.name ?? '',
      isOrg: false,
      ini: p.n[0],
      remove: () => setPeopleSel((prev) => prev.filter((x) => !(x.n === p.n && x.t === p.t))),
    })
  })
  const total = teamsSel.reduce((a, tid) => a + (orgById(tid)?.count ?? 0), 0) + peopleSel.length

  const collectNames = () =>
    peopleSel
      .map((p) => p.n)
      .concat(
        teamsSel
          .reduce<string[]>((a, tid) => a.concat(orgById(tid)?.members ?? []), [])
          .filter((n) => !peopleSel.some((p) => p.n === n)),
      )

  const confirm = () => {
    if (chips.length === 0) return
    const label = `${t('admin-pk-picked')} · ${chips[0].name}${chips.length > 1 ? ` ${t('admin-pk-more', { n: chips.length - 1 })}` : ''} · ${t('admin-pk-total', { n: total })}`
    onConfirm({ names: collectNames(), label, total })
  }

  const title = mode === 'admin' ? t('admin-pk-title-admin') : t('admin-pk-title-scope')
  const hint = mode === 'admin' ? t('admin-pk-hint-admin') : t('admin-pk-hint-scope')

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--scrim-modal)] p-4"
      role="presentation"
    >
      <div className="flex max-h-[calc(100dvh-64px)] w-[720px] max-w-full flex-col overflow-hidden rounded-lg bg-card shadow-[var(--shadow-modal)]">
        <div className="flex items-center gap-2.5 border-b border-gray-100 px-5 pt-4 pb-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[15px] font-bold">{title}</span>
            <span className="text-xs text-gray-400">{hint}</span>
          </div>
          <button
            type="button"
            aria-label={t('common-cancel')}
            onClick={onClose}
            className="ml-auto inline-flex size-7 flex-none items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <XIcon />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 min-[560px]:grid-cols-[minmax(0,1fr)_270px]">
          {/* 좌: 조직 트리 */}
          <div className="flex h-[380px] flex-col border-b border-gray-100 min-[560px]:border-r min-[560px]:border-b-0">
            <div className="relative flex-none p-2.5 pb-1">
              <SearchIcon className="pointer-events-none absolute top-[18px] left-[22px] text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('admin-pk-search')}
                className="h-[34px] w-full rounded-lg border border-gray-200 bg-gray-50 pr-2.5 pl-[34px] text-[12.5px] focus:border-primary focus:bg-card focus:outline-none"
              />
            </div>
            <div className="flex flex-1 flex-col gap-px overflow-y-auto px-2 pt-1 pb-2.5">
              {rows.map((r) => (
                <div
                  key={r.key}
                  onClick={r.onToggle}
                  className="flex min-h-[28px] cursor-pointer items-center gap-[7px] rounded-md py-px pr-2 hover:bg-gray-50"
                  style={{ paddingLeft: 8 + r.depth * 15 }}
                >
                  {r.hasKids ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        r.onExpand()
                      }}
                      className="flex-none text-gray-400"
                      style={{ transform: r.expanded ? 'rotate(90deg)' : 'none' }}
                      aria-label="expand"
                    >
                      <ChevronRight />
                    </button>
                  ) : (
                    <span className="w-[13px] flex-none" />
                  )}
                  <PickCheckbox on={r.on} mixed={r.mixed} />
                  {r.isRoot && <BuildingIcon />}
                  {r.isPerson && (
                    <span className="inline-flex size-[22px] flex-none items-center justify-center rounded-full bg-l-blue text-[10.5px] font-bold text-on-pastel">
                      {r.ini}
                    </span>
                  )}
                  <span className="truncate text-[13px] text-gray-800">{r.name}</span>
                  {r.count != null && (
                    <span className="flex-none text-xs text-gray-400">{r.count}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 우: 선택 목록 */}
          <div className="flex h-[380px] flex-col">
            <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
              {chips.length === 0 ? (
                <span className="px-2 py-6 text-center text-[12.5px] text-gray-400">
                  {t('admin-pk-empty')}
                </span>
              ) : (
                chips.map((c) => (
                  <div
                    key={c.key}
                    className="flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-gray-50"
                  >
                    <span className="inline-flex size-[30px] flex-none items-center justify-center rounded-full bg-l-blue">
                      {c.isOrg ? (
                        <OrgIcon />
                      ) : (
                        <span className="text-xs font-bold text-on-pastel">{c.ini}</span>
                      )}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-px">
                      <span className="truncate text-[13px] font-semibold text-gray-900">
                        {c.name}
                      </span>
                      <span className="truncate text-[11.5px] text-gray-400">{c.sub}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={t('common-cancel')}
                      onClick={c.remove}
                      className="inline-flex size-6 flex-none items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-destructive"
                    >
                      <XIcon size={11} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-gray-100 p-3">
              <span className="text-[13px] text-gray-600">{t('admin-pk-total', { n: total })}</span>
              <button
                type="button"
                onClick={() => {
                  setTeamsSel([])
                  setPeopleSel([])
                }}
                className="ml-auto inline-flex h-[30px] items-center rounded-[5px] border border-gray-200 bg-card px-[11px] text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                {t('admin-pk-reset')}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 pt-3 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-[38px] items-center rounded-[5px] border border-gray-200 bg-card px-4 text-[13.5px] font-semibold text-gray-800 hover:bg-gray-100"
          >
            {t('common-cancel')}
          </button>
          <button
            type="button"
            onClick={confirm}
            className="inline-flex h-[38px] items-center rounded-[5px] bg-primary px-[18px] text-[13.5px] font-semibold text-white hover:bg-ov-blue-700"
          >
            {t('common-confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

function PickCheckbox({ on, mixed }: { on: boolean; mixed: boolean }) {
  return (
    <span
      className={[
        'inline-flex size-4 flex-none items-center justify-center rounded border-[1.5px] text-white',
        on || mixed ? 'border-primary bg-primary' : 'border-gray-300 bg-card',
      ].join(' ')}
    >
      {on && (
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4.5 12.5l5 5 10-11" />
        </svg>
      )}
      {!on && mixed && (
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
        >
          <path d="M6 12h12" />
        </svg>
      )}
    </span>
  )
}

function XIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-transform"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M15.8 15.8L21 21" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-gray-500)"
      strokeWidth="1.8"
      strokeLinejoin="round"
      className="flex-none"
    >
      <rect x="5" y="3.5" width="14" height="17" />
      <path d="M9 7.5h2M13 7.5h2M9 11h2M13 11h2M9 14.5h2M13 14.5h2M10.5 20.5v-3h3v3" />
    </svg>
  )
}

function OrgIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-primary)"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.9-2.8 3-4.2 5.5-4.2s4.6 1.4 5.5 4.2" />
      <path d="M15.5 5.4a3.2 3.2 0 0 1 0 5.2M17.8 14.9c1.4.7 2.4 2 2.9 3.9" />
    </svg>
  )
}
