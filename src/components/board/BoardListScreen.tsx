import { useEffect, useState } from 'react'

import { Link, useNavigate, useParams } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import { BOARDS, DEFAULT_BOARD } from './listData'
import type { BoardRow, BoardView } from './listData'
import { useNotices, usePosts } from '@/hooks/usePosts'
import type { Post } from '@/types/post'

const COLS = 'minmax(0,1fr) 130px 110px 96px 64px 64px'
const PASTELS = ['bg-l-blue', 'bg-l-green', 'bg-l-orange', 'bg-l-purple', 'bg-l-mint', 'bg-l-pink']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function pastel(seed: string) {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PASTELS[h % PASTELS.length]
}
function fmtDate(s?: string | null) {
  return s ? s.slice(0, 10).replace(/-/g, '.') : ''
}
// API Post → 목록 뷰모델(BoardRow). 읽음여부는 is_view($appends), 아바타색은 이름/id 파생.
function toRow(p: Post): BoardRow {
  const author = p.user?.name ?? ''
  return {
    id: p.id,
    title: p.title,
    location: p.board?.title ?? '',
    author,
    authorInitial: author ? author[0] : '?',
    avatarBg: pastel(author || String(p.user_id)),
    date: fmtDate(p.posted_at ?? p.created_at),
    views: p.view_count,
    likes: p.like_count,
    comments: p.comment_count,
    notice: (p.badges ?? []).some((b) => b.type === 'NOTICE'),
    read: p.is_view ?? true, // 서버가 글마다 읽음여부 제공(없으면 읽음 취급)
    hasFile: (p.files?.length ?? 0) > 0,
    snippet: p.text_content ?? '',
    hasThumb: !!p.thumbnail,
    thumbBg: pastel(p.id),
  }
}

interface RowCtx {
  open: (id: string | number) => void
  bookmarks: Set<string | number>
  onBm: (id: string | number) => void
  onCopy: () => void
}

export function BoardListScreen() {
  const { t } = useTranslation()
  const { boardId } = useParams({ from: '/board/$boardId' })
  const board = BOARDS[boardId] ?? DEFAULT_BOARD
  const navigate = useNavigate()
  const [view, setView] = useState<BoardView>('board')
  const [listFilter, setListFilter] = useState<'all' | 'unread'>('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState('20')
  const [countOpen, setCountOpen] = useState(false)
  const [boardFav, setBoardFav] = useState(false)
  const [bookmarks, setBookmarks] = useState<Set<string | number>>(new Set())
  const [toast, setToast] = useState<string | null>(null)

  // 라우트 param이 실제 UUID면 board_id로 필터, 샘플 슬러그면 전체 접근 가능 글
  const boardIdParam = UUID_RE.test(boardId) ? boardId : undefined
  // 안읽음(안 본 글)=is_view 0, 전체=생략 (서버측 필터). 공지·일반 목록에 동일 적용.
  const isView = listFilter === 'unread' ? false : undefined
  // 일반 목록: 공지 제외(except_badges) + 페이지네이션. 공지는 아래 useNotices로 따로.
  const { data, isLoading, isError, refetch } = usePosts({
    board_id: boardIdParam,
    except_badges: ['NOTICE'],
    take: Number(perPage),
    page,
    sort: { by: 'posted_at', order: 'desc' },
    is_view: isView,
  })
  // 공지: 유효한 NOTICE 글 전량(is_not_paging), 모든 페이지 상단 고정. 안읽음이면 안 읽은 공지만.
  const { data: noticeData } = useNotices({ board_id: boardIdParam, is_view: isView })
  const notices = (noticeData ?? []).map(toRow)
  const listRows = (data?.data ?? []).map(toRow)
  const rows = [...notices, ...listRows] // 공지 먼저(상단 고정), 그 뒤 일반 목록
  const totalPages = data?.last_page ?? 1
  const totalCount = (data?.total ?? 0) + notices.length // "N개의 글" = 일반글 + 공지
  const isEmpty = !isLoading && !isError && rows.length === 0

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(id)
  }, [toast])

  const ctx: RowCtx = {
    open: (id) => navigate({ to: '/post/$postId', params: { postId: String(id) } }),
    bookmarks,
    onBm: (id) =>
      setBookmarks((prev) => {
        const next = new Set(prev)
        const has = next.has(id)
        if (has) next.delete(id)
        else next.add(id)
        setToast(t(has ? 'drive-bm-remove' : 'drive-bm-add'))
        return next
      }),
    onCopy: () => setToast(t('common-link-copied')),
  }

  const windowStart = Math.floor((page - 1) / 10) * 10 + 1
  const pages: number[] = []
  for (let i = 0; i < 10 && windowStart + i <= totalPages; i++) pages.push(windowStart + i)
  const atFirst = page === 1
  const atLast = page >= totalPages

  const views: { key: BoardView; label: string; icon: React.ReactNode }[] = [
    { key: 'board', label: t('list-view-basic'), icon: <BasicIcon /> },
    { key: 'preview', label: t('list-view-preview'), icon: <PreviewIcon /> },
    { key: 'album', label: t('list-view-album'), icon: <AlbumIcon /> },
  ]

  return (
    <div className="flex w-full flex-col gap-3.5">
      {/* 헤더 한 줄: 게시판명 · 즐겨찾기 · 글 개수 | (우) 전체·안읽음 · 개수 · 뷰타입 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-lg font-extrabold tracking-[-0.01em]">{board.name}</span>
        <button
          type="button"
          aria-label={t('nav-favorites')}
          aria-pressed={boardFav}
          onClick={() => {
            setBoardFav((v) => !v)
            setToast(t(boardFav ? 'list-fav-remove' : 'list-fav-add'))
          }}
          className={`inline-flex size-[30px] flex-none items-center justify-center rounded-lg hover:bg-gray-100 ${boardFav ? 'text-warning' : 'text-gray-300'}`}
        >
          <StarIcon filled={boardFav} />
        </button>
        <span className="flex-none text-[12.5px] text-gray-400">
          {t('list-count', { n: totalCount })}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* 전체 / 안읽음 필터 */}
          <div className="inline-flex gap-0.5 rounded-[5px] bg-gray-100 p-0.5">
            <button
              type="button"
              aria-pressed={listFilter === 'all'}
              onClick={() => {
                setListFilter('all')
                setPage(1)
              }}
              className={`inline-flex h-[30px] items-center rounded px-3 text-[12.5px] font-semibold ${listFilter !== 'unread' ? 'bg-card text-primary shadow-[0_4px_8px_rgba(0,0,0,0.1)]' : 'text-gray-500'}`}
            >
              {t('list-filter-all')}
            </button>
            <button
              type="button"
              aria-pressed={listFilter === 'unread'}
              onClick={() => {
                setListFilter('unread')
                setPage(1)
              }}
              className={`inline-flex h-[30px] items-center rounded px-3 text-[12.5px] font-semibold ${listFilter === 'unread' ? 'bg-card text-primary shadow-[0_4px_8px_rgba(0,0,0,0.1)]' : 'text-gray-500'}`}
            >
              {t('list-filter-unread')}
            </button>
          </div>

          {/* 개수 드롭다운 */}
          <div className="relative flex-none">
            <button
              type="button"
              onClick={() => setCountOpen((v) => !v)}
              className="inline-flex h-[34px] items-center gap-1.5 rounded-[5px] border border-gray-200 bg-card px-3 text-[12.5px] whitespace-nowrap text-gray-700 hover:bg-gray-100"
            >
              {t('list-per-page', { n: perPage })}
              <ChevronDownIcon className={countOpen ? 'rotate-180' : ''} />
            </button>
            {countOpen && (
              <>
                <button
                  type="button"
                  aria-label="close"
                  className="fixed inset-0 z-20 cursor-default"
                  onClick={() => setCountOpen(false)}
                />
                <div className="absolute top-[calc(100%+4px)] right-0 z-30 w-[130px] rounded-lg border border-gray-200 bg-card p-1 shadow-[0_4px_8px_rgba(0,0,0,0.1)]">
                  {['10', '20', '30'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setPerPage(v)
                        setPage(1)
                        setCountOpen(false)
                      }}
                      className={`flex h-[34px] w-full items-center rounded-md px-2.5 text-[12.5px] hover:bg-gray-100 ${v === perPage ? 'font-semibold text-primary' : 'text-gray-800'}`}
                    >
                      {t('list-per-page', { n: v })}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 뷰 전환 */}
          <div className="inline-flex gap-0.5 rounded-[5px] bg-gray-100 p-0.5">
            {views.map((v) => (
              <button
                key={v.key}
                type="button"
                aria-label={v.label}
                aria-pressed={view === v.key}
                onClick={() => setView(v.key)}
                className={`flex h-[30px] w-8 items-center justify-center rounded ${view === v.key ? 'bg-card text-primary' : 'text-gray-400'}`}
              >
                {v.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 뷰 / 로딩 / 에러 / 빈 상태 */}
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListSkeleton />
      ) : isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {view === 'board' && <BoardView rows={rows} ctx={ctx} />}
          {view === 'preview' && <PreviewView rows={rows} ctx={ctx} />}
          {view === 'album' && <AlbumView rows={rows} ctx={ctx} />}

          {/* 페이지네이션 */}
          <div className="flex items-center justify-center gap-[3px] py-1.5">
            <PageArrow disabled={atFirst} onClick={() => setPage(1)} label="처음">
              <DoubleChevron dir="left" />
            </PageArrow>
            <PageArrow disabled={atFirst} onClick={() => setPage(page - 1)} label="이전">
              <Chevron dir="left" />
            </PageArrow>
            {pages.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`mx-px inline-flex h-7 min-w-[28px] items-center justify-center rounded-full border px-1.5 text-[12.5px] ${
                  n === page
                    ? 'border-primary font-bold text-primary'
                    : 'border-transparent text-gray-500 hover:bg-gray-100'
                }`}
              >
                {n}
              </button>
            ))}
            <PageArrow disabled={atLast} onClick={() => setPage(page + 1)} label="다음">
              <Chevron dir="right" />
            </PageArrow>
            <PageArrow disabled={atLast} onClick={() => setPage(totalPages)} label="마지막">
              <DoubleChevron dir="right" />
            </PageArrow>
          </div>
        </>
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-[18px] left-1/2 z-[80] flex h-11 max-w-[92%] -translate-x-1/2 items-center gap-2.5 rounded-lg bg-gray-900 px-4 text-[13.5px] text-gray-50 shadow-[var(--shadow-modal)]">
          <CheckIcon />
          <span className="truncate">{toast}</span>
        </div>
      )}
    </div>
  )
}

/* ── 로딩 스켈레톤 ── */
function ListSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-card">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-gray-100 px-[18px] py-3.5">
          <span className="size-[22px] flex-none animate-pulse rounded-full bg-gray-100" />
          <span className="h-3.5 flex-1 animate-pulse rounded bg-gray-100" />
          <span className="h-3.5 w-16 flex-none animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  )
}

/* ── 에러 상태 ── */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3.5 rounded-lg border border-gray-200 bg-card px-5 py-16">
      <span className="inline-flex size-[52px] items-center justify-center rounded-full bg-l-red text-destructive">
        <svg
          className="size-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5V13M12 16.5h.01" />
        </svg>
      </span>
      <span className="text-[13.5px] text-gray-500">{t('list-error')}</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-9 items-center rounded-[5px] border border-gray-200 bg-card px-4 text-[13px] font-semibold text-gray-700 hover:bg-gray-100"
      >
        {t('common-retry')}
      </button>
    </div>
  )
}

/* ── 빈 목록 상태 ── */
function EmptyState() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3.5 rounded-lg border border-gray-200 bg-card px-5 py-16">
      <span className="inline-flex size-[52px] items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <svg
          className="size-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M14 3v5h5" />
        </svg>
      </span>
      <span className="text-[13.5px] text-gray-500">{t('list-empty')}</span>
      <Link
        to="/write"
        className="inline-flex h-9 items-center gap-1.5 rounded-[5px] bg-primary px-4 text-[13px] font-semibold text-white hover:bg-ov-blue-700"
      >
        <PlusIcon />
        {t('board-write')}
      </Link>
    </div>
  )
}

/* ── 행 hover 퀵액션 (북마크 + 링크복사) ── */
function RowActions({ id, ctx }: { id: string | number; ctx: RowCtx }) {
  const { t } = useTranslation()
  const marked = ctx.bookmarks.has(id)
  return (
    <span className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-0.5 rounded-lg bg-card/95 opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-opacity group-hover:opacity-100">
      <button
        type="button"
        aria-label={t('nav-favorites')}
        onClick={(e) => {
          e.stopPropagation()
          ctx.onBm(id)
        }}
        className={`inline-flex size-8 items-center justify-center rounded-lg hover:bg-gray-100 ${marked ? 'text-warning' : 'text-gray-400'}`}
      >
        <StarIcon filled={marked} small />
      </button>
      <button
        type="button"
        aria-label={t('common-link-copied')}
        onClick={(e) => {
          e.stopPropagation()
          ctx.onCopy()
        }}
        className="inline-flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
      >
        <LinkIcon />
      </button>
    </span>
  )
}

/* ── 기본형 (테이블) ── */
function BoardView({ rows, ctx }: { rows: BoardRow[]; ctx: RowCtx }) {
  const { t } = useTranslation()
  return (
    <div className="bg-card">
      <div className="overflow-x-auto">
        <div className="min-w-[940px]">
          <div
            className="grid h-[42px] items-center border-b border-gray-200 px-1 text-xs text-gray-500"
            style={{ gridTemplateColumns: COLS }}
          >
            <span>{t('col-title')}</span>
            <span>{t('col-location')}</span>
            <span>{t('col-author')}</span>
            <span>{t('col-date')}</span>
            <span className="text-center">{t('col-views')}</span>
            <span className="text-center">{t('col-likes')}</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.id}
              role="button"
              tabIndex={0}
              onClick={() => ctx.open(r.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && ctx.open(r.id)}
              className={`group relative grid min-h-[46px] w-full cursor-pointer items-center border-b border-gray-100 px-1 text-left hover:bg-gray-50 ${r.notice ? 'bg-accent' : ''}`}
              style={{ gridTemplateColumns: COLS }}
            >
              <span className="flex min-w-0 items-center gap-[7px] pr-3.5">
                <TitleCell r={r} notice={t('badge-notice')} />
              </span>
              <span className="truncate pr-2 text-[12.5px] text-gray-500">{r.location}</span>
              <span className="flex min-w-0 items-center gap-1.5 pr-2">
                <Avatar r={r} />
                <span className="truncate text-[12.5px] text-gray-600">{r.author}</span>
              </span>
              <span className="text-[12.5px] whitespace-nowrap text-gray-500">{r.date}</span>
              <span className="text-center text-[12.5px] text-gray-500">
                {r.views.toLocaleString()}
              </span>
              <span className="text-center text-[12.5px] text-gray-500">{r.likes}</span>
              <RowActions id={r.id} ctx={ctx} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── 미리보기형 ── */
function PreviewView({ rows, ctx }: { rows: BoardRow[]; ctx: RowCtx }) {
  const { t } = useTranslation()
  return (
    <div className="border-t border-gray-200">
      {rows.map((r) => (
        <div
          key={r.id}
          role="button"
          tabIndex={0}
          onClick={() => ctx.open(r.id)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && ctx.open(r.id)}
          className={`group relative flex w-full cursor-pointer gap-4 border-b border-gray-100 px-1 py-5 text-left hover:bg-gray-50 ${r.notice ? 'bg-accent' : ''}`}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex min-w-0 items-center gap-[7px]">
              {!r.read && (
                <span className="size-1.5 flex-none rounded-full bg-primary" aria-label="안 읽음" />
              )}
              {r.notice && <NoticeBadge label={t('badge-notice')} />}
              <span
                className={`truncate text-sm ${r.read ? 'font-normal text-gray-500' : 'font-semibold text-gray-900'}`}
              >
                {r.title}
              </span>
              {r.comments > 0 && <CommentCount n={r.comments} />}
            </span>
            <span className="line-clamp-2 text-[12.5px] leading-[1.55] text-gray-500">
              {r.snippet}
            </span>
            <span className="flex items-center gap-2 text-xs text-gray-400">
              <span>{r.author}</span>
              <span>·</span>
              <span>{r.date}</span>
              <span>·</span>
              <span>
                {t('col-views')} {r.views.toLocaleString()}
              </span>
              <span>·</span>
              <span>
                {t('col-likes')} {r.likes}
              </span>
            </span>
          </span>
          {r.hasThumb && (
            <span
              className={`inline-flex h-[76px] w-[120px] flex-none items-center justify-center rounded-lg text-on-pastel opacity-85 ${r.thumbBg}`}
            >
              <ImageIcon />
            </span>
          )}
          <RowActions id={r.id} ctx={ctx} />
        </div>
      ))}
    </div>
  )
}

/* ── 앨범형 (공지 포함 그리드) ── */
function AlbumView({ rows, ctx }: { rows: BoardRow[]; ctx: RowCtx }) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3.5">
      {rows.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => ctx.open(r.id)}
          className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-card text-left hover:shadow-[0_4px_8px_rgba(0,0,0,0.1)]"
        >
          <span
            className={`flex h-[120px] items-center justify-center text-on-pastel opacity-90 ${r.thumbBg}`}
          >
            <ImageIcon large />
          </span>
          <span className="flex flex-col gap-1.5 px-3.5 pt-3 pb-3.5">
            <span className="flex min-w-0 items-center gap-1.5">
              {!r.read && (
                <span className="size-1.5 flex-none rounded-full bg-primary" aria-label="안 읽음" />
              )}
              {r.notice && <NoticeBadge label={t('badge-notice')} />}
              <span
                className={`truncate text-[13.5px] ${r.read ? 'font-normal text-gray-500' : 'font-semibold text-gray-900'}`}
              >
                {r.title}
              </span>
            </span>
            <span className="flex items-center gap-[7px] text-[11.5px] text-gray-400">
              <span>{r.author}</span>
              <span>·</span>
              <span>{r.date}</span>
            </span>
            <span className="text-[11.5px] text-gray-400">
              {t('col-views')} {r.views.toLocaleString()} · {t('col-likes')} {r.likes}
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}

function TitleCell({ r, notice }: { r: BoardRow; notice: string }) {
  return (
    <>
      {r.read ? null : (
        <span className="size-1.5 flex-none rounded-full bg-primary" aria-label="안 읽음" />
      )}
      {r.notice && <NoticeBadge label={notice} />}
      <span
        className={`truncate text-[13.5px] ${r.read ? 'font-normal text-gray-500' : 'font-semibold text-gray-900'}`}
      >
        {r.title}
      </span>
      {r.hasFile && <PaperclipIcon />}
      {r.comments > 0 && <CommentCount n={r.comments} />}
    </>
  )
}

function Avatar({ r }: { r: BoardRow }) {
  return (
    <span
      className={`inline-flex size-[22px] flex-none items-center justify-center rounded-full text-[10.5px] font-bold text-on-pastel ${r.avatarBg}`}
    >
      {r.authorInitial}
    </span>
  )
}
function NoticeBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex h-5 flex-none items-center rounded bg-l-blue px-[7px] text-[10.5px] font-bold text-primary">
      {label}
    </span>
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
        aria-hidden="true"
      >
        <path d="M20.5 12.5c0 3.9-3.8 7-8.5 7-1 0-2-.15-2.9-.42L4 20.5l1.5-3.6A6.6 6.6 0 0 1 3.5 12.5c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7z" />
      </svg>
      {n}
    </span>
  )
}

function PageArrow({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-[30px] items-center justify-center rounded-[5px] text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

/* ── 아이콘 ── */
function StarIcon({ filled, small }: { filled: boolean; small?: boolean }) {
  return (
    <svg
      className={small ? 'size-[15px]' : 'size-[17px]'}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8-4.3-4.1 5.9-.9z" />
    </svg>
  )
}
function LinkIcon() {
  return (
    <svg
      className="size-[15px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5" />
      <path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.5-1.5" />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg
      className="size-4 flex-none"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-accent)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  )
}
function BasicIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}
function PreviewIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="7" rx="1.5" />
      <rect x="4" y="14" width="16" height="7" rx="1.5" />
    </svg>
  )
}
function AlbumIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
function PaperclipIcon() {
  return (
    <svg
      className="size-[13px] flex-none text-gray-400"
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
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`size-3.5 text-gray-400 transition-transform ${className ?? ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}
function ImageIcon({ large }: { large?: boolean }) {
  return (
    <svg
      className={large ? 'size-[26px]' : 'size-[22px]'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M3.5 16.5l5-4.5 4 3.5 3.5-3 4.5 4" />
    </svg>
  )
}
function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {dir === 'left' ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
    </svg>
  )
}
function DoubleChevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      className="size-[15px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {dir === 'left' ? (
        <path d="M17.5 5l-7 7 7 7M10.5 5l-7 7 7 7" />
      ) : (
        <path d="M6.5 5l7 7-7 7M13.5 5l7 7-7 7" />
      )}
    </svg>
  )
}
