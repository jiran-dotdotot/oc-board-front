import { useEffect, useState } from 'react'

import { Link, useNavigate, useParams } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import { NOTICE_ROTATE_MS } from './constants'
import { BOARDS, DEFAULT_BOARD } from './listData'
import type { BoardRow, BoardView } from './listData'
import { useBoard, useBoardBookmarkMutation, useBookmarkedBoards } from '@/hooks/useBoards'
import { useNotices, usePosts } from '@/hooks/usePosts'
import type { Post } from '@/types/post'

// 디자인 정본: 제목 / 작성자 / 작성일 / 조회 / 공감 — '위치' 컬럼은 없다
// (게시판 안에 있으니 소속이 자명하다). 모바일은 이 grid를 쓰지 않고 한 줄로 접는다.
const COLS = 'minmax(300px,1fr) 130px 96px 60px 60px'

// 데스크톱 테이블 ↔ 모바일 한 줄. HomeScreen과 같은 패턴.
const ROW =
  'w-full items-center border-b border-gray-100 flex flex-col gap-1 px-3.5 py-[11px] min-h-[62px] min-[631px]:grid min-[631px]:flex-row min-[631px]:gap-0 min-[631px]:px-[18px] min-[631px]:py-0 min-[631px]:min-h-12'
const CELL_DESKTOP = 'hidden truncate text-[12.5px] min-[631px]:block'
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
  const navigate = useNavigate()
  const [view, setView] = useState<BoardView>('board')
  const [listFilter, setListFilter] = useState<'all' | 'unread'>('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState('20')
  const [countOpen, setCountOpen] = useState(false)
  const [bookmarks, setBookmarks] = useState<Set<string | number>>(new Set())
  const [toast, setToast] = useState<string | null>(null)
  // 공지 배너: 순회 인덱스 + 「전체 보기」 모달
  const [ntIdx, setNtIdx] = useState(0)
  const [ntAllOpen, setNtAllOpen] = useState(false)
  // 배너에 마우스가 올라가거나 포커스가 들어오면 순환을 멈춘다 — 읽는 중에 바뀌면 안 되고,
  // 누르려는 순간 대상이 바뀌면 엉뚱한 글이 열린다.
  const [ntPaused, setNtPaused] = useState(false)
  // 전환 방향 — 자동/다음은 오른쪽에서 들어오고, 이전은 왼쪽에서 들어온다(누른 버튼과 방향을 맞춘다).
  const [ntDir, setNtDir] = useState<'next' | 'prev'>('next')

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
  // 공지: 유효한 NOTICE 글 전량(is_not_paging). 목록에 섞지 않고 위 배너로 순회한다(디자인 정본).
  // ⚠ is_view를 넘기지 않는다 — 전체/안읽음 토글은 일반 목록에만 걸고, 배너는 항상 전량을 받아
  //   읽음/안읽음 개수를 함께 표시해야 한다.
  const { data: noticeData } = useNotices({ board_id: boardIdParam })
  const notices = (noticeData ?? []).map(toRow)
  const rows = (data?.data ?? []).map(toRow) // 일반 목록(공지 제외 — except_badges)
  const totalPages = data?.last_page ?? 1
  const totalCount = (data?.total ?? 0) + notices.length // "N개의 글" = 일반글 + 공지
  const isEmpty = !isLoading && !isError && rows.length === 0

  // 배너는 안 읽은 공지를 우선 순회한다. 다 읽었으면 전체를 순회한다.
  const unreadNotices = notices.filter((n) => !n.read)
  const ntPool = unreadNotices.length > 0 ? unreadNotices : notices
  const ntPos = ntPool.length > 0 ? ntIdx % ntPool.length : 0
  const ntCur = ntPool[ntPos]
  const ntLabel =
    unreadNotices.length > 0
      ? t('list-notice-index-unread', {
          i: ntPos + 1,
          unread: unreadNotices.length,
          total: notices.length,
        })
      : t('list-notice-index-all', { i: ntPos + 1, total: notices.length })
  const ntStep = (d: number) => {
    setNtDir(d < 0 ? 'prev' : 'next')
    setNtIdx((v) => (ntPool.length > 0 ? (v + d + ntPool.length) % ntPool.length : 0))
  }

  // 자동 순환. ntIdx를 deps에 두어 수동으로 넘겼을 때도 주기가 처음부터 다시 돈다.
  // 멈추는 조건: 공지 1건 이하 · hover/포커스 · 「공지 전체」 모달 열림 · 모션 최소화 설정.
  useEffect(() => {
    if (ntPool.length < 2 || ntPaused || ntAllOpen) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = setTimeout(() => {
      setNtDir('next')
      setNtIdx((v) => (v + 1) % ntPool.length)
    }, NOTICE_ROTATE_MS)
    return () => clearTimeout(id)
  }, [ntIdx, ntPool.length, ntPaused, ntAllOpen])

  // 게시판 헤더: 이름은 GET /board/{board}, 즐겨찾기는 북마크 목록 + 공용 토글 mutation.
  // 슬러그 데모 경로(/board/notice)는 UUID가 아니라 쿼리가 꺼지므로 mock 이름으로 폴백한다.
  const { data: boardDetail } = useBoard(boardIdParam)
  const boardName = boardDetail?.title ?? (BOARDS[boardId] ?? DEFAULT_BOARD).name
  const { data: favorites = [] } = useBookmarkedBoards()
  const boardFav = !!boardIdParam && favorites.some((b) => b.id === boardIdParam)
  const { mutate: toggleBoardBookmark } = useBoardBookmarkMutation()

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
        <span className="text-lg font-extrabold tracking-[-0.01em]">{boardName}</span>
        {boardIdParam && (
          <button
            type="button"
            aria-label={t('nav-favorites')}
            aria-pressed={boardFav}
            onClick={() => {
              toggleBoardBookmark(boardIdParam)
              setToast(t(boardFav ? 'list-fav-remove' : 'list-fav-add'))
            }}
            className={`inline-flex size-[30px] flex-none items-center justify-center rounded-lg hover:bg-gray-100 ${boardFav ? 'text-warning' : 'text-gray-300'}`}
          >
            <StarIcon filled={boardFav} />
          </button>
        )}
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

      {/* 공지 배너 — 목록에 섞지 않고 한 건씩 순회한다 (디자인 정본) */}
      {ntCur && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => ctx.open(ntCur.id)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && ctx.open(ntCur.id)}
          onMouseEnter={() => setNtPaused(true)}
          onMouseLeave={() => setNtPaused(false)}
          onFocus={() => setNtPaused(true)}
          onBlur={() => setNtPaused(false)}
          className="flex h-[42px] cursor-pointer items-center gap-[9px] rounded-lg border border-ov-blue-200 bg-ov-blue-50 pr-1 pl-2.5"
        >
          <span className="inline-flex h-[19px] flex-none items-center rounded bg-primary px-[7px] text-[10.5px] font-bold text-white">
            {t('badge-notice')}
          </span>
          {/* overflow-hidden: 가로 슬라이드(16px)가 인덱스 라벨 위로 삐져나오지 않게 제목 영역에서 자른다 */}
          <span className="flex min-w-0 flex-1 overflow-hidden">
            <span
              key={ntCur.id}
              className={`flex min-w-0 flex-1 animate-in items-center gap-1.5 fade-in duration-300 ease-out motion-reduce:animate-none ${
                ntDir === 'prev' ? 'slide-in-from-left-4' : 'slide-in-from-right-4'
              }`}
            >
              {!ntCur.read && <span className="size-1.5 flex-none rounded-full bg-primary" />}
              <span className="truncate text-[13px] font-semibold text-gray-900">
                {ntCur.title}
              </span>
            </span>
          </span>
          {notices.length > 1 && (
            <span className="flex-none text-[11.5px] whitespace-nowrap text-gray-400 tabular-nums">
              {ntLabel}
            </span>
          )}
          {ntPool.length > 1 && (
            <>
              <NoticeNav label={t('list-notice-prev')} onClick={() => ntStep(-1)} dir="left" />
              <NoticeNav label={t('list-notice-next')} onClick={() => ntStep(1)} dir="right" />
            </>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setNtAllOpen(true)
            }}
            className="inline-flex h-[26px] flex-none items-center rounded-md px-2.5 text-[11.5px] font-semibold text-primary hover:bg-ov-blue-100"
          >
            {t('list-notice-all')}
          </button>
        </div>
      )}

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

      {/* 공지 전체 모달 */}
      {ntAllOpen && (
        <NoticeAllModal
          notices={notices}
          onClose={() => setNtAllOpen(false)}
          onPick={(id) => {
            setNtAllOpen(false)
            ctx.open(id)
          }}
        />
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

/* ── 공지 배너 이전/다음 ── */
function NoticeNav({
  label,
  onClick,
  dir,
}: {
  label: string
  onClick: () => void
  dir: 'left' | 'right'
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="inline-flex size-[26px] flex-none items-center justify-center rounded-md text-gray-500 hover:bg-ov-blue-100"
    >
      <Chevron dir={dir} />
    </button>
  )
}

/* ── 공지 전체 모달 ── */
function NoticeAllModal({
  notices,
  onClose,
  onPick,
}: {
  notices: BoardRow[]
  onClose: () => void
  onPick: (id: string | number) => void
}) {
  const { t } = useTranslation()
  // ESC로 닫기 (디자인의 전역 _esc와 같은 규약)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--scrim-modal)] p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('list-notice-all-title')}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[calc(100dvh-80px)] w-[560px] max-w-[94%] flex-col overflow-hidden rounded-xl bg-card shadow-[var(--shadow-modal)]"
      >
        <div className="flex h-[54px] flex-none items-center gap-2 border-b border-gray-100 px-5">
          <span className="text-[15px] font-bold">{t('list-notice-all-title')}</span>
          <span className="text-xs text-gray-400 tabular-nums">{notices.length}</span>
          <button
            type="button"
            aria-label={t('common-close')}
            onClick={onClose}
            className="ml-auto inline-flex size-[30px] items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {notices.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onPick(n.id)}
              className="flex w-full items-center gap-[9px] rounded-lg px-3 py-2.5 text-left hover:bg-gray-50"
            >
              <span className="inline-flex h-[19px] flex-none items-center rounded bg-l-blue px-[7px] text-[10.5px] font-bold text-primary">
                {t('badge-notice')}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex min-w-0 items-center gap-1.5">
                  {!n.read && <span className="size-1.5 flex-none rounded-full bg-primary" />}
                  <span
                    className={`truncate text-[13px] ${n.read ? 'font-normal text-gray-500' : 'font-semibold text-gray-900'}`}
                  >
                    {n.title}
                  </span>
                </span>
                <span className="text-[11.5px] text-gray-400">
                  {t('list-meta', { author: n.author, date: n.date, views: n.views })}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
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
    <span className="absolute top-1/2 right-2.5 hidden -translate-y-1/2 items-center gap-0.5 rounded-lg bg-card/95 opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-opacity group-hover:opacity-100 min-[631px]:flex">
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
      <div
        className="hidden h-[42px] items-center border-b border-gray-200 px-[18px] text-xs text-gray-500 min-[631px]:grid"
        style={{ gridTemplateColumns: COLS }}
      >
        <span>{t('col-title')}</span>
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
          className={`group relative cursor-pointer text-left hover:bg-gray-50 ${ROW} ${r.notice ? 'bg-accent' : ''}`}
          style={{ gridTemplateColumns: COLS }}
        >
          <span className="flex w-full min-w-0 items-center gap-[7px] min-[631px]:w-auto min-[631px]:pr-3.5">
            <TitleCell r={r} notice={t('badge-notice')} />
          </span>
          {/* 모바일: 숨는 컬럼을 한 줄로 접는다 */}
          <span className="w-full truncate text-[11.5px] text-gray-400 min-[631px]:hidden">
            {t('list-meta', { author: r.author, date: r.date, views: r.views })}
          </span>
          <span className="hidden min-w-0 items-center gap-1.5 pr-2 min-[631px]:flex">
            <Avatar r={r} />
            <span className="truncate text-[12.5px] text-gray-600">{r.author}</span>
          </span>
          <span className={`${CELL_DESKTOP} whitespace-nowrap text-gray-500`}>{r.date}</span>
          <span className={`${CELL_DESKTOP} text-center text-gray-500`}>
            {r.views.toLocaleString()}
          </span>
          <span className={`${CELL_DESKTOP} text-center text-gray-500`}>{r.likes}</span>
          <RowActions id={r.id} ctx={ctx} />
        </div>
      ))}
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
function CloseIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
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
