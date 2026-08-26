import { useEffect, useRef, useState } from 'react'

import { Link } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import { DEFAULT_QUERY, FILE_RESULTS, POST_RESULTS, RECENTS } from './searchData'

export function SearchScreen() {
  const { t } = useTranslation()
  const [q, setQ] = useState(DEFAULT_QUERY)
  const [recentOpen, setRecentOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(true)
  const [preset, setPreset] = useState('1m')
  const [tab, setTab] = useState<'post' | 'file'>('post')
  const [recents, setRecents] = useState(RECENTS)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setRecentOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const hasResults = q.trim().length > 0
  const presets = [
    { value: '1w', label: t('search-preset-1w') },
    { value: '1m', label: t('search-preset-1m') },
    { value: '3m', label: t('search-preset-3m') },
    { value: '6m', label: t('search-preset-6m') },
    { value: 'custom', label: t('search-preset-custom') },
  ]

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      {/* 검색바 */}
      <div ref={searchRef} className="relative">
        <div
          className={`flex h-12 items-center gap-2.5 rounded-[5px] border bg-card px-3.5 ${q ? 'border-primary' : 'border-gray-300'}`}
        >
          <SearchIcon />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setRecentOpen(true)}
            placeholder={t('nav-search-placeholder')}
            className="min-w-0 flex-1 border-none bg-transparent text-[15px] text-gray-900 outline-none"
          />
          {q && (
            <button
              type="button"
              aria-label={t('common-cancel')}
              onClick={() => {
                setQ('')
                setRecentOpen(true)
              }}
              className="inline-flex size-[22px] flex-none items-center justify-center rounded-full bg-gray-100 text-gray-500"
            >
              <XIcon />
            </button>
          )}
          <button
            type="button"
            className="inline-flex h-[34px] flex-none items-center rounded-[5px] bg-primary px-[15px] text-[13.5px] font-semibold text-white hover:bg-ov-blue-700"
          >
            {t('common-search')}
          </button>
        </div>
        {recentOpen && recents.length > 0 && (
          <div className="absolute inset-x-0 top-[calc(100%+4px)] z-30 rounded-lg border border-gray-200 bg-card p-1.5 shadow-[0_4px_8px_rgba(0,0,0,0.1)]">
            <div className="flex h-[30px] items-center px-2.5 text-[11.5px] text-gray-400">
              {t('search-recent')}
              <button
                type="button"
                onClick={() => setRecents([])}
                className="ml-auto text-gray-400 hover:text-destructive"
              >
                {t('search-clear-all')}
              </button>
            </div>
            {recents.map((r, i) => (
              <div
                key={r}
                className="flex h-9 items-center gap-2.5 rounded-[5px] px-2.5 hover:bg-gray-100"
              >
                <ClockIcon />
                <button
                  type="button"
                  onClick={() => {
                    setQ(r)
                    setRecentOpen(false)
                  }}
                  className="min-w-0 flex-1 truncate text-left text-[13.5px] text-gray-800"
                >
                  {r}
                </button>
                <button
                  type="button"
                  aria-label={t('common-cancel')}
                  onClick={() => setRecents(recents.filter((_, idx) => idx !== i))}
                  className="inline-flex size-[22px] flex-none items-center justify-center rounded-[5px] text-gray-300 hover:bg-gray-100 hover:text-gray-600"
                >
                  <XIcon small />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 상세 검색 토글 */}
      <div className="-mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          className={`inline-flex h-[34px] items-center gap-1.5 rounded-[5px] border px-[13px] text-[13px] font-semibold ${filterOpen ? 'border-primary bg-accent text-primary' : 'border-gray-200 bg-card text-gray-700'}`}
        >
          <FilterIcon />
          {t('search-advanced')}
          <Chevron open={filterOpen} />
        </button>
        <span className="text-xs text-gray-400">{t('search-advanced-hint')}</span>
      </div>

      {/* 필터 패널 */}
      {filterOpen && (
        <div className="-mt-2.5 flex flex-col gap-3.5 rounded-lg border border-gray-200 bg-card px-5 py-[18px]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-14 flex-none text-[13px] font-semibold text-gray-700">
              {t('search-period')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPreset(p.value)}
                  className={`inline-flex h-[30px] items-center rounded-full px-[13px] text-[12.5px] font-semibold ${preset === p.value ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {preset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 pl-[68px]">
              <DateChip>2026.05.12</DateChip>
              <span className="text-gray-400">~</span>
              <DateChip>2026.08.12</DateChip>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-14 flex-none text-[13px] font-semibold text-gray-700">
              {t('nav-board')}
            </span>
            <button
              type="button"
              className="inline-flex h-9 w-[220px] items-center gap-2 rounded-[5px] border border-gray-200 bg-card px-3"
            >
              <span className="flex-1 text-left text-[13px] text-gray-400">
                {t('search-board-all')}
              </span>
              <Chevron />
            </button>
            <span className="w-14 flex-none text-[13px] font-semibold text-gray-700">
              {t('search-author')}
            </span>
            <input
              placeholder={t('search-author-ph')}
              className="h-9 w-[150px] rounded-[5px] border border-gray-300 bg-card px-3 text-[13px] outline-none focus:border-primary"
            />
          </div>
        </div>
      )}

      {/* 결과 탭 */}
      <div className="flex gap-6 border-b border-gray-200">
        <TabButton
          active={tab === 'post'}
          onClick={() => setTab('post')}
          label={t('search-tab-posts')}
          count={hasResults ? POST_RESULTS.length : 0}
        />
        <TabButton
          active={tab === 'file'}
          onClick={() => setTab('file')}
          label={t('search-tab-files')}
          count={hasResults ? FILE_RESULTS.length : 0}
        />
      </div>

      {/* 결과 */}
      {!hasResults ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-gray-200 bg-card px-5 py-16">
          <span className="inline-flex size-[52px] items-center justify-center rounded-full bg-accent text-primary">
            <SearchIcon big />
          </span>
          <span className="text-[13.5px] text-gray-500">{t('search-empty')}</span>
          <span className="text-xs text-gray-400">{t('search-empty-sub')}</span>
        </div>
      ) : tab === 'post' ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-card">
          {POST_RESULTS.map((r) => (
            <Link
              key={r.id}
              to="/post/$postId"
              params={{ postId: String(r.id) }}
              className="flex flex-col gap-1.5 border-b border-gray-100 px-[18px] py-4 last:border-b-0 hover:bg-gray-50"
            >
              <span className="text-sm leading-[1.5] font-semibold text-gray-900">
                <Highlight text={r.title} q={q} />
              </span>
              <span className="line-clamp-2 text-[12.5px] leading-[1.6] [overflow-wrap:anywhere] text-gray-500">
                <Highlight text={r.snippet} q={q} />
              </span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                <span className="text-gray-500">{r.board}</span>
                <span>·</span>
                <span>{r.author}</span>
                <span>·</span>
                <span>{r.date}</span>
                {r.hasFile && <PaperclipIcon />}
                {r.comments > 0 && (
                  <span className="inline-flex items-center gap-0.5 font-semibold text-primary">
                    <CommentIcon />
                    {r.comments}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-card">
          {FILE_RESULTS.map((f) => (
            <div
              key={f.name}
              className="flex items-center gap-2.5 border-b border-gray-100 px-[18px] py-[13px] last:border-b-0 hover:bg-gray-50"
            >
              <span
                className={`inline-flex h-5 w-10 flex-none items-center justify-center rounded text-[10px] font-bold text-on-pastel ${f.tagBg}`}
              >
                {f.ext}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="truncate text-[13.5px] text-gray-900">
                  <Highlight text={f.name} q={q} />
                </span>
                <span className="text-[11.5px] text-gray-400">{f.meta}</span>
              </span>
              <button
                type="button"
                aria-label={t('file-download')}
                className="inline-flex size-[30px] flex-none items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <DownloadIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Highlight({ text, q }: { text: string; q: string }) {
  const query = q.trim()
  if (!query) return <>{text}</>
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase() ? (
          <span key={i} className="font-semibold text-primary">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-0.5 pb-2.5 text-sm font-semibold whitespace-nowrap ${active ? 'border-primary text-gray-900' : 'border-transparent text-gray-500'}`}
    >
      {label} <span className={active ? 'text-primary' : 'text-gray-400'}>{count}</span>
    </button>
  )
}

function DateChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-9 items-center gap-2 rounded-[5px] border border-gray-200 bg-card px-3 text-[13px] text-gray-800">
      <CalendarIcon />
      {children}
    </span>
  )
}

/* ── 아이콘 ── */
function SearchIcon({ big }: { big?: boolean }) {
  return (
    <svg
      className={big ? 'size-[23px]' : 'size-[18px] flex-none text-gray-400'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M15.8 15.8L21 21" />
    </svg>
  )
}
function XIcon({ small }: { small?: boolean }) {
  return (
    <svg
      className={small ? 'size-2.5' : 'size-2.5'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg
      className="size-[13px] flex-none text-gray-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}
function FilterIcon() {
  return (
    <svg
      className="size-[14px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  )
}
function Chevron({ open }: { open?: boolean }) {
  return (
    <svg
      className={`size-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg
      className="size-[14px] flex-none text-gray-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5" />
    </svg>
  )
}
function PaperclipIcon() {
  return (
    <svg
      className="size-3 text-gray-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M20 12.5l-7.6 7.6a5 5 0 0 1-7-7L13 5.5a3.3 3.3 0 0 1 4.7 4.7L10.5 17a1.7 1.7 0 0 1-2.4-2.4l6.6-6.6" />
    </svg>
  )
}
function CommentIcon() {
  return (
    <svg
      className="size-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.5 12.5c0 3.9-3.8 7-8.5 7-1 0-2-.15-2.9-.42L4 20.5l1.5-3.6A6.6 6.6 0 0 1 3.5 12.5c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7z" />
    </svg>
  )
}
function DownloadIcon() {
  return (
    <svg
      className="size-[15px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4v11M7 10.5l5 5 5-5" />
      <path d="M4.5 19.5h15" />
    </svg>
  )
}
