import { useEffect, useMemo, useState } from 'react'

import { useNavigate } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import {
  COLUMN_CFG,
  type ChipKey,
  DRAFTS,
  IMPORTANT,
  INITIAL_TRASH,
  INITIAL_TRASH_CHECKS,
  ME,
  MY_POSTS,
  type MyRow,
  SCHEDULED,
} from '@/components/mypage/myData'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { Toast } from '@/components/common/Toast'
import { useToast } from '@/components/common/useToast'

type ImpTab = 'all' | 'post' | 'file'

const CHIP_ORDER: ChipKey[] = ['important', 'my', 'draft', 'schedule', 'trash']
const CHIP_KEY = {
  important: 'my-chip-important',
  my: 'my-chip-my',
  draft: 'my-chip-draft',
  schedule: 'my-chip-schedule',
  trash: 'my-chip-trash',
} as const

const STATIC_ROWS: Record<Exclude<ChipKey, 'trash'>, MyRow[]> = {
  important: IMPORTANT,
  my: MY_POSTS,
  draft: DRAFTS,
  schedule: SCHEDULED,
}

export function MyActivityScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [chip, setChip] = useState<ChipKey>('important')
  const [impTab, setImpTab] = useState<ImpTab>('all')
  const [trashRows, setTrashRows] = useState<MyRow[]>(INITIAL_TRASH)
  const [checksByChip, setChecksByChip] = useState<Record<ChipKey, boolean[]>>({
    important: IMPORTANT.map(() => false),
    my: MY_POSTS.map(() => false),
    draft: DRAFTS.map(() => false),
    schedule: SCHEDULED.map(() => false),
    trash: INITIAL_TRASH_CHECKS,
  })
  const [purgeOpen, setPurgeOpen] = useState(false)
  // 오버레이가 떠 있는 동안 배경 스크롤 잠금(중첩은 참조 카운팅)
  useBodyScrollLock(purgeOpen)
  const { toast, showToast, hideToast } = useToast()

  // 토스트 자동 소멸

  // ESC → 영구삭제 모달 닫기
  useEffect(() => {
    if (!purgeOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPurgeOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [purgeOpen])

  const isTrash = chip === 'trash'

  const rows = useMemo(() => {
    if (isTrash) return trashRows
    if (chip === 'important') {
      if (impTab === 'post') return IMPORTANT.filter((r) => !r.isFile)
      if (impTab === 'file') return IMPORTANT.filter((r) => r.isFile)
      return IMPORTANT
    }
    return STATIC_ROWS[chip]
  }, [chip, impTab, isTrash, trashRows])

  const checks = (checksByChip[chip] ?? []).slice(0, rows.length)
  const selCount = checks.filter(Boolean).length
  const allChecked = rows.length > 0 && selCount === rows.length
  const allMixed = selCount > 0 && !allChecked

  const setChecks = (arr: boolean[]) => setChecksByChip((prev) => ({ ...prev, [chip]: arr }))

  const pickChip = (c: ChipKey) => {
    setChip(c)
    if (c === 'important') setImpTab('all')
  }
  const pickTab = (tb: ImpTab) => {
    setImpTab(tb)
    setChecksByChip((prev) => ({ ...prev, important: IMPORTANT.map(() => false) }))
  }
  const toggleAll = () => setChecks(rows.map(() => !allChecked))
  const toggleRow = (i: number) => {
    const next = rows.map((_, idx) => (idx === i ? !checks[idx] : !!checks[idx]))
    setChecks(next)
  }

  const doRestore = () => {
    const n = selCount
    const remain = trashRows.filter((_, i) => !checks[i])
    setTrashRows(remain)
    setChecksByChip((prev) => ({ ...prev, trash: remain.map(() => false) }))
    showToast(t('my-toast-restore', { n }))
  }
  const doPurge = () => {
    const n = selCount
    const remain = trashRows.filter((_, i) => !checks[i])
    setTrashRows(remain)
    setChecksByChip((prev) => ({ ...prev, trash: remain.map(() => false) }))
    setPurgeOpen(false)
    showToast(t('my-toast-purge', { n }))
  }
  const moveToTrash = () => {
    const n = selCount
    setChecks(rows.map(() => false))
    showToast(t('my-toast-trash', { n }))
  }

  const impCounts = {
    all: IMPORTANT.length,
    post: IMPORTANT.filter((r) => !r.isFile).length,
    file: IMPORTANT.filter((r) => r.isFile).length,
  }
  const cfg = COLUMN_CFG[chip]

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5">
      {/* 프로필 요약 카드 */}
      <div className="flex flex-wrap items-center gap-3.5 rounded-xl border border-gray-200 bg-card px-6 py-5">
        <span className="inline-flex size-[52px] flex-none items-center justify-center rounded-full bg-l-blue text-xl font-bold text-on-pastel">
          {ME.initial}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-lg font-extrabold">{ME.name}</span>
          <span className="text-s text-gray-500">{ME.meta}</span>
        </div>
        <div className="ml-auto flex flex-none gap-[18px]">
          <Stat n={IMPORTANT.length + 20} label={t('my-chip-my')} />
          <Stat n={ME.comments} label={t('my-stat-comments')} />
          <Stat n={IMPORTANT.length + 14} label={t('my-chip-important')} />
        </div>
      </div>

      {/* 필터 칩 5종 */}
      <div className="flex flex-wrap gap-1.5">
        {CHIP_ORDER.map((c) => {
          const on = chip === c
          return (
            <button
              key={c}
              type="button"
              onClick={() => pickChip(c)}
              className={[
                'inline-flex h-8 items-center gap-1.5 rounded-full px-[15px] text-s font-semibold whitespace-nowrap',
                on ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:opacity-90',
              ].join(' ')}
            >
              {t(CHIP_KEY[c])}
              {c === 'draft' && (
                <span className="text-xs font-bold opacity-80">{DRAFTS.length}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* 중요 서브탭 (전체/게시글/자료) */}
      {chip === 'important' && (
        <div className="-mt-1 flex gap-5 border-b border-gray-200">
          {(['all', 'post', 'file'] as ImpTab[]).map((tb) => {
            const on = impTab === tb
            return (
              <button
                key={tb}
                type="button"
                onClick={() => pickTab(tb)}
                className={[
                  '-mb-px border-b-2 px-0.5 pb-[9px] text-sm font-semibold whitespace-nowrap',
                  on ? 'border-primary text-gray-900' : 'border-transparent text-gray-500',
                ].join(' ')}
              >
                {t(`my-tab-${tb}`)}{' '}
                <span className={on ? 'text-primary' : 'text-gray-400'}>{impCounts[tb]}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* 일괄 선택 툴바 */}
      {selCount > 0 && (
        <div className="-mb-1 flex flex-wrap items-center gap-2">
          <span className="text-s text-gray-600">
            <b className="text-primary">{selCount}</b>
            {t('drive-selected-suffix')}
          </span>
          {isTrash ? (
            <>
              <ToolbarBtn onClick={doRestore} icon={<RestoreIcon />}>
                {t('my-restore')}
              </ToolbarBtn>
              <ToolbarBtn onClick={() => setPurgeOpen(true)} icon={<TrashIcon />} danger>
                {t('my-purge')}
              </ToolbarBtn>
            </>
          ) : (
            <ToolbarBtn onClick={moveToTrash} icon={<TrashIcon />} danger>
              {t('common-delete')}
            </ToolbarBtn>
          )}
        </div>
      )}

      {/* 리스트 (다열 그리드) */}
      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-card">
          <div className="overflow-x-auto">
            <div style={{ minWidth: cfg.minW }}>
              {/* 헤더 (컬럼 라벨) */}
              <div
                className="grid h-10 items-center gap-2.5 border-b border-gray-200 bg-gray-50 px-3.5 text-xs text-gray-500"
                style={{ gridTemplateColumns: cfg.cols }}
              >
                <Checkbox
                  checked={allChecked}
                  mixed={allMixed}
                  onClick={toggleAll}
                  active={selCount > 0}
                />
                <span>{t('col-title')}</span>
                <span>{t('col-location')}</span>
                {cfg.trash && (
                  <>
                    <span>{t('my-col-deleter')}</span>
                    <span>{t('col-regdate')}</span>
                  </>
                )}
                <span>{t(cfg.dateKey)}</span>
                {cfg.stats && (
                  <>
                    <span className="text-center">{t('col-views')}</span>
                    <span className="text-center">{t('col-likes')}</span>
                  </>
                )}
                {cfg.action && <span />}
              </div>
              {/* 행 */}
              {rows.map((r, i) => (
                <div
                  key={`${chip}-${r.title}-${i}`}
                  className={[
                    'grid min-h-[46px] items-center gap-2.5 border-b border-gray-100 px-3.5 hover:bg-gray-50',
                    checks[i] ? 'bg-gray-50' : '',
                  ].join(' ')}
                  style={{ gridTemplateColumns: cfg.cols }}
                >
                  <Checkbox
                    checked={!!checks[i]}
                    onClick={() => toggleRow(i)}
                    active={!!checks[i]}
                  />
                  {/* 제목 셀 */}
                  <span className="flex min-w-0 items-center gap-[7px] pr-3.5">
                    {r.isBookmark && (
                      <button
                        type="button"
                        aria-label={t('my-chip-important')}
                        onClick={() => showToast(t('drive-bm-remove'))}
                        className="inline-flex size-[22px] flex-none items-center justify-center rounded text-warning hover:bg-gray-200"
                      >
                        <BookmarkIcon filled />
                      </button>
                    )}
                    {r.isFile && (
                      <span
                        className={`inline-flex h-5 w-10 flex-none items-center justify-center rounded text-2xs font-bold text-on-pastel ${r.tagBg ?? 'bg-l-gray'}`}
                      >
                        {r.ext}
                      </span>
                    )}
                    {r.isNotice && (
                      <span className="inline-flex h-[19px] flex-none items-center rounded bg-l-blue px-[7px] text-2xs font-bold text-primary">
                        {t('badge-notice')}
                      </span>
                    )}
                    <span
                      className={[
                        'truncate text-sm',
                        r.dim ? 'font-normal text-gray-400' : 'font-semibold text-gray-900',
                      ].join(' ')}
                    >
                      {r.title}
                    </span>
                    {r.hasFile && <PaperclipIcon />}
                    {r.cmt != null && r.cmt > 0 && <CommentCount n={r.cmt} />}
                  </span>
                  {/* 위치 */}
                  <span className="truncate pr-2.5 text-s text-gray-500">{r.where}</span>
                  {/* 휴지통: 삭제자 · 등록일 */}
                  {cfg.trash && (
                    <>
                      <span className="truncate pr-2 text-s text-gray-600">{r.by}</span>
                      <span className="text-s whitespace-nowrap text-gray-500">
                        {r.created}
                      </span>
                    </>
                  )}
                  {/* 날짜 */}
                  <span className="text-s whitespace-nowrap text-gray-500">{r.when}</span>
                  {/* 조회 · 공감 */}
                  {cfg.stats && (
                    <>
                      <span className="text-center text-s text-gray-500">{r.views}</span>
                      <span className="text-center text-s text-gray-500">{r.likes}</span>
                    </>
                  )}
                  {/* 액션 (이어쓰기) */}
                  {cfg.action && (
                    <span className="flex justify-end">
                      {r.action && (
                        <button
                          type="button"
                          onClick={() => navigate({ to: '/write' })}
                          className="inline-flex h-[29px] flex-none items-center rounded-[5px] border border-gray-200 bg-card px-[11px] text-xs font-semibold whitespace-nowrap text-gray-700 hover:bg-gray-100"
                        >
                          {t('my-action-continue')}
                        </button>
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-gray-200 bg-card px-5 py-16">
          <span className="inline-flex size-[52px] items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <TrashIcon size={22} />
          </span>
          <span className="text-sm text-gray-500">{t('my-empty-trash')}</span>
        </div>
      )}

      {/* 영구삭제 확인 모달 */}
      {purgeOpen && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--scrim-modal)]"
          role="presentation"
        >
          <div className="flex w-[330px] flex-col items-center gap-2 rounded-lg bg-card px-[22px] pt-[26px] pb-[18px] shadow-[var(--shadow-modal)]">
            <span className="inline-flex size-[42px] items-center justify-center rounded-full bg-l-red text-destructive">
              <TrashIcon size={20} />
            </span>
            <span className="mt-1 text-center text-sm font-semibold">
              {t('my-purge-confirm', { n: selCount })}
            </span>
            <span className="text-center text-s text-gray-500">{t('my-purge-sub')}</span>
            <div className="mt-2.5 flex w-full gap-2">
              <button
                type="button"
                onClick={() => setPurgeOpen(false)}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-[5px] border border-gray-200 bg-card text-sm font-semibold text-gray-800 hover:bg-gray-100"
              >
                {t('common-cancel')}
              </button>
              <button
                type="button"
                onClick={doPurge}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-[5px] bg-destructive text-sm font-semibold text-white hover:opacity-90"
              >
                {t('my-purge')}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={hideToast} />
    </div>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <span className="flex flex-col items-center gap-px">
      <span className="text-base font-extrabold text-primary">{n}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </span>
  )
}

function ToolbarBtn({
  onClick,
  icon,
  danger,
  children,
}: {
  onClick: () => void
  icon: React.ReactNode
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex h-8 items-center gap-1.5 rounded-[5px] border border-gray-200 bg-card px-[13px] text-s font-semibold whitespace-nowrap',
        danger ? 'text-destructive hover:bg-l-red' : 'text-gray-700 hover:bg-gray-100',
      ].join(' ')}
    >
      {icon}
      {children}
    </button>
  )
}

function Checkbox({
  checked,
  mixed,
  onClick,
  active,
}: {
  checked: boolean
  mixed?: boolean
  onClick: () => void
  active: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex size-4 flex-none items-center justify-center rounded border-[1.5px] text-white',
        active ? 'border-primary bg-primary' : 'border-gray-300 bg-card',
      ].join(' ')}
    >
      {checked && (
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
      {!checked && mixed && (
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
    </button>
  )
}

function BookmarkIcon({ filled }: { filled?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      className="flex-none"
    >
      <path d="M6.5 3.5h11V21L12 17l-5.5 4z" />
    </svg>
  )
}

function PaperclipIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="flex-none text-gray-400"
    >
      <path d="M20 12.5l-7.6 7.6a5 5 0 0 1-7-7L13 5.5a3.3 3.3 0 0 1 4.7 4.7L10.5 17a1.7 1.7 0 0 1-2.4-2.4l6.6-6.6" />
    </svg>
  )
}

function CommentCount({ n }: { n: number }) {
  return (
    <span className="inline-flex flex-none items-center gap-0.5 text-xs font-semibold text-primary">
      <svg
        className="size-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <path d="M20.5 12.5c0 3.9-3.8 7-8.5 7-1 0-2-.15-2.9-.42L4 20.5l1.5-3.6A6.6 6.6 0 0 1 3.5 12.5c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7z" />
      </svg>
      {n}
    </span>
  )
}

function RestoreIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 11.5A8 8 0 1 0 18.9 16" />
      <path d="M20 5v6.5h-6.5" />
    </svg>
  )
}

function TrashIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
    </svg>
  )
}

