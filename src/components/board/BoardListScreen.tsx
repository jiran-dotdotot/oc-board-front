import { useEffect, useState } from 'react'

import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'

import { useQueryClient } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import {
  LIMIT_DEFAULT_DESKTOP,
  LIMIT_DEFAULT_MOBILE,
  LIMIT_OPTIONS,
  MOBILE_MAX_WIDTH,
  NOTICE_TOP_CAP,
  readStoredLimit,
  writeStoredLimit,
} from './constants'
import { BOARDS, DEFAULT_BOARD } from './listData'
import type { BoardListSearch, BoardRow, BoardView } from './listData'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useBoard, useBoardBookmarkMutation, useBookmarkedBoards } from '@/hooks/useBoards'
import { Toast } from '@/components/common/Toast'
import { useToast } from '@/components/common/useToast'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useNotices, usePostBookmarkMutation, usePosts } from '@/hooks/usePosts'
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
    bookmarked: !!p.is_bookmark, // raw SQL alias 가능성 → truthy 판정
    hasFile: (p.files?.length ?? 0) > 0,
    snippet: p.text_content ?? '',
    hasThumb: !!p.thumbnail,
    thumbBg: pastel(p.id),
  }
}

interface RowCtx {
  open: (id: string | number) => void
  onBm: (row: BoardRow) => void
  onCopy: () => void
}

export function BoardListScreen() {
  const { t } = useTranslation()
  const { boardId } = useParams({ from: '/board/$boardId' })
  const search = useSearch({ from: '/board/$boardId' })
  const navigate = useNavigate()
  // URL 이 정본. 기본값은 URL에 쓰지 않고 여기서 채운다(레거시와 같은 규약).
  const setSearch = (patch: Partial<BoardListSearch>) =>
    navigate({
      to: '/board/$boardId',
      params: { boardId },
      search: (prev: BoardListSearch) => ({ ...prev, ...patch }),
    })
  const listFilter = search.read ?? 'all'
  const page = search.page ?? 1
  // 개수 기본값: URL → localStorage(레거시 'postLimit') → 기기폭(모바일 20 / 데스크톱 10)
  const [deviceLimit] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth <= MOBILE_MAX_WIDTH
      ? LIMIT_DEFAULT_MOBILE
      : LIMIT_DEFAULT_DESKTOP,
  )
  const [storedLimit] = useState(readStoredLimit)
  const perPage = search.limit ?? storedLimit ?? deviceLimit
  const [countOpen, setCountOpen] = useState(false)
  const { toast, showToast, hideToast } = useToast()
  // 공지 6a: 상단 3건 고정 + 「숨은 공지 N건 모두 보기」 토글.
  // 펼침 상태는 페이지를 옮겨도 유지한다(디자인 「공지 초과 표시 시안」 6a 노트).
  const [ntExpanded, setNtExpanded] = useState(false)

  // 라우트 param이 실제 UUID면 board_id로 필터, 샘플 슬러그면 전체 접근 가능 글
  const boardIdParam = UUID_RE.test(boardId) ? boardId : undefined
  // 안읽음(안 본 글)=is_view 0, 전체=생략 (서버측 필터). 공지·일반 목록에 동일 적용.
  const isView = listFilter === 'before' ? false : undefined
  // 모바일은 페이지네이션 대신 무한 스크롤(레거시 · 디자인 갤러리 4 「모바일 = 무한스크롤」).
  // 페이지를 «이어 붙이는» 대신 take 를 키워 1페이지로 다시 받는다 — 누적 배열·중복 제거가
  // 필요 없고, 사이에 새 글이 끼어들어 행이 밀리거나 빠지는 오프셋 페이지네이션 문제도 없다.
  const isMobile = useIsMobile()
  // 게시판·필터·개수가 바뀌면 처음부터 다시 쌓는다.
  // effect 로 setState 하면 리셋 전 «옛 묶음»이 한 프레임 그려진다 → 렌더 중 파생으로 처리
  // (React 공식 「props 가 바뀔 때 state 조정」 패턴).
  const scope = `${boardIdParam ?? ''}|${listFilter}|${perPage}`
  const [loaded, setLoaded] = useState({ scope, pages: 1 })
  const loadedPages = loaded.scope === scope ? loaded.pages : 1
  if (loaded.scope !== scope) setLoaded({ scope, pages: 1 })
  const loadMore = () => setLoaded({ scope, pages: loadedPages + 1 })
  // 일반 목록: 공지 제외(except_badges) + 페이지네이션. 공지는 아래 useNotices로 따로.
  const { data, isLoading, isError, refetch } = usePosts({
    board_id: boardIdParam,
    except_badges: ['NOTICE'],
    take: isMobile ? perPage * loadedPages : perPage,
    page: isMobile ? 1 : page,
    sort: { by: 'posted_at', order: 'desc' },
    is_view: isView,
  })
  // 공지: 유효한 NOTICE 글(is_not_paging). 목록에 섞지 않고 위 배너로 순회한다(디자인 정본).
  // 읽음 필터는 공지에도 적용한다 — 레거시 selectNoticePosts 가 is_view 를 함께 넘긴다.
  const { data: noticeData } = useNotices({ board_id: boardIdParam, is_view: isView })
  const notices = (noticeData ?? []).map(toRow)
  const rows = (data?.data ?? []).map(toRow) // 일반 목록(공지 제외 — except_badges)
  const totalPages = data?.last_page ?? 1
  // ⚠ 공지는 페이지네이션 카운트에서 분리한다 — 디자인 「공지 초과 표시 시안」의 전제(관례).
  const totalCount = data?.total ?? 0
  const isEmpty = !isLoading && !isError && rows.length === 0

  // 상한 3건까지만 고정 노출, 나머지는 토글로 펼친다.
  const shownNotices = ntExpanded ? notices : notices.slice(0, NOTICE_TOP_CAP)
  const hiddenNoticeCount = Math.max(0, notices.length - NOTICE_TOP_CAP)

  // 게시판 헤더: 이름은 GET /board/{board}, 즐겨찾기는 북마크 목록 + 공용 토글 mutation.
  // 슬러그 데모 경로(/board/notice)는 UUID가 아니라 쿼리가 꺼지므로 mock 이름으로 폴백한다.
  const { data: boardDetail, error: boardError } = useBoard(boardIdParam)
  // 삭제된 게시판: 알리고 → 사이드바에서 지우고 → 홈으로. (레거시 onMounted .catch(404) 규약)
  // 자동 리다이렉트만 하면 왜 튕겼는지 알 수 없어, 확인 버튼이 있는 모달로 막고 이동한다.
  const boardErrStatus = (boardError as { response?: { status?: number } } | null)?.response
    ?.status
  // 404=삭제됨 · 403=읽기 권한 없음. 둘 다 이 화면에 머물 이유가 없으니 알리고 홈으로.
  // 403 이 났다는 건 사이드바 트리가 오래됐다는 뜻이기도 하다 → 캐시도 함께 갱신한다.
  const blockedMessage =
    boardErrStatus === 404
      ? t('list-board-deleted')
      : boardErrStatus === 403
        ? t('list-board-forbidden')
        : null
  const boardName = boardDetail?.title ?? (BOARDS[boardId] ?? DEFAULT_BOARD).name
  // 뷰타입: URL 지정이 없으면 게시판에 설정된 type 을 쓴다 — ALBUM 게시판은 앨범형으로 열린다.
  // (레거시 onMounted 의 `if (!route.query.viewType) viewType = board.type` 과 같은 규약)
  const boardType = boardDetail?.type
  const view: BoardView =
    search.viewType ?? (boardType === 'PREVIEW' || boardType === 'ALBUM' ? boardType : 'BOARD')
  const { data: favorites = [] } = useBookmarkedBoards()
  const boardFav = !!boardIdParam && favorites.some((b) => b.id === boardIdParam)
  const { mutate: toggleBoardBookmark } = useBoardBookmarkMutation()
  const { mutate: togglePostBookmark } = usePostBookmarkMutation()
  const queryClient = useQueryClient()
  // 모바일에서 아직 못 받은 일반글이 남았는가 (공지는 카운트에서 분리돼 있다)
  const hasMore = isMobile && rows.length < (data?.total ?? 0)
  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !isLoading)


  const ctx: RowCtx = {
    open: (id) => navigate({ to: '/post/$postId', params: { postId: String(id) } }),
    onBm: (row) => {
      togglePostBookmark(String(row.id))
      showToast(t(row.bookmarked ? 'drive-bm-remove' : 'drive-bm-add'))
    },
    onCopy: () => showToast(t('common-link-copied')),
  }

  const windowStart = Math.floor((page - 1) / 10) * 10 + 1
  const pages: number[] = []
  for (let i = 0; i < 10 && windowStart + i <= totalPages; i++) pages.push(windowStart + i)
  const atFirst = page === 1
  const atLast = page >= totalPages

  const views: { key: BoardView; label: string; icon: React.ReactNode }[] = [
    { key: 'BOARD', label: t('list-view-basic'), icon: <BasicIcon /> },
    { key: 'PREVIEW', label: t('list-view-preview'), icon: <PreviewIcon /> },
    { key: 'ALBUM', label: t('list-view-album'), icon: <AlbumIcon /> },
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
              showToast(t(boardFav ? 'list-fav-remove' : 'list-fav-add'))
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
              onClick={() => setSearch({ read: undefined, page: undefined })}
              className={`inline-flex h-[30px] items-center rounded px-3 text-[12.5px] font-semibold ${listFilter !== 'before' ? 'bg-card text-primary shadow-[0_4px_8px_rgba(0,0,0,0.1)]' : 'text-gray-500'}`}
            >
              {t('list-filter-all')}
            </button>
            <button
              type="button"
              aria-pressed={listFilter === 'before'}
              onClick={() => setSearch({ read: 'before', page: undefined })}
              className={`inline-flex h-[30px] items-center rounded px-3 text-[12.5px] font-semibold ${listFilter === 'before' ? 'bg-card text-primary shadow-[0_4px_8px_rgba(0,0,0,0.1)]' : 'text-gray-500'}`}
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
                  className="fixed inset-0 z-[var(--z-dropdown)] cursor-default"
                  onClick={() => setCountOpen(false)}
                />
                <div className="absolute top-[calc(100%+4px)] right-0 z-[var(--z-dropdown)] w-[130px] rounded-lg border border-gray-200 bg-card p-1 shadow-[0_4px_8px_rgba(0,0,0,0.1)]">
                  {LIMIT_OPTIONS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        // 선택은 기기에 남는다(레거시와 같은 키) + URL 에도 실어 공유 가능하게.
                        writeStoredLimit(v)
                        setSearch({ limit: v, page: undefined })
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
                onClick={() => setSearch({ viewType: v.key })}
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
        <EmptyState canWrite={!!boardDetail?.is_writable} />
      ) : (
        <>
          {view === 'BOARD' && (
            <BoardView
              rows={rows}
              ctx={ctx}
              notices={shownNotices}
              hiddenCount={hiddenNoticeCount}
              expanded={ntExpanded}
              onToggleNotices={() => setNtExpanded((v) => !v)}
            />
          )}
          {view === 'PREVIEW' && <PreviewView rows={rows} ctx={ctx} />}
          {view === 'ALBUM' && <AlbumView rows={rows} ctx={ctx} />}

          {/* 모바일 무한 스크롤 센티널 — 바닥 100px 전에 다음 묶음을 불러온다 */}
          {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />}

          {/* 페이지네이션 — 데스크톱 전용. 모바일은 무한 스크롤이고,
              lastPage>1 일 때만 노출한다(디자인 갤러리 4 확정 #4). */}
          {!isMobile && totalPages > 1 && (
          <div className="flex items-center justify-center gap-[3px] py-1.5">
            <PageArrow disabled={atFirst} onClick={() => setSearch({ page: undefined })} label="처음">
              <DoubleChevron dir="left" />
            </PageArrow>
            <PageArrow disabled={atFirst} onClick={() => setSearch({ page: page - 1 > 1 ? page - 1 : undefined })} label="이전">
              <Chevron dir="left" />
            </PageArrow>
            {pages.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSearch({ page: n > 1 ? n : undefined })}
                className={`mx-px inline-flex h-7 min-w-[28px] items-center justify-center rounded-full border px-1.5 text-[12.5px] ${
                  n === page
                    ? 'border-primary font-bold text-primary'
                    : 'border-transparent text-gray-500 hover:bg-gray-100'
                }`}
              >
                {n}
              </button>
            ))}
            <PageArrow disabled={atLast} onClick={() => setSearch({ page: page + 1 })} label="다음">
              <Chevron dir="right" />
            </PageArrow>
            <PageArrow disabled={atLast} onClick={() => setSearch({ page: totalPages })} label="마지막">
              <DoubleChevron dir="right" />
            </PageArrow>
          </div>
          )}
        </>
      )}

      {blockedMessage && (
        <BoardBlockedModal
          message={blockedMessage}
          onClose={() => {
            // 사이드바에 남아 있는 죽은 항목을 걷어낸다
            queryClient.invalidateQueries({ queryKey: ['categories'] })
            queryClient.invalidateQueries({ queryKey: ['boards', 'bookmarked'] })
            navigate({ to: '/', replace: true })
          }}
        />
      )}

      <Toast toast={toast} onClose={hideToast} />
    </div>
  )
}

/* ── 접근할 수 없는 게시판 안내 (404 삭제 · 403 권한없음) ──
   갤러리 4 구현 노트 #1: 닫기 «경로»를 하나로 모은다. 확인 버튼·스크림 클릭·ESC 중
   어느 쪽으로 닫아도 반드시 같은 onClose 가 돈다 — 레거시는 스크림으로 닫으면
   콜백(뒤로가기)이 누락돼 사용자가 빈 화면에 남았다.
   토스트가 아니라 모달인 이유: 리다이렉트와 함께 화면이 바뀌면 이유가 전달되지 않는다. */
function BoardBlockedModal({ message, onClose }: { message: string; onClose: () => void }) {
  const { t } = useTranslation()
  useBodyScrollLock(true)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--scrim-modal)] p-4"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex w-[320px] max-w-full flex-col items-center gap-[18px] rounded-lg bg-card px-[22px] pt-[26px] pb-[18px] shadow-[var(--shadow-modal)]"
      >
        <span className="text-center text-[14.5px] font-semibold text-gray-900">{message}</span>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="h-10 w-full rounded-[5px] bg-primary text-sm font-semibold text-white hover:bg-ov-blue-700"
        >
          {t('common-confirm')}
        </button>
      </div>
    </div>
  )
}

/* ── 안읽음 표시 ──
   점(형태) + 색 두 축을 함께 쓴다. 색만 남기면(gray-900↔gray-500) 색 대비 하나로만
   상태를 전달하게 되어 WCAG 1.4.1(색에만 의존하지 않기)에 걸리고, 스크린리더에는
   안읽음 정보가 아예 전달되지 않는다. 대신 볼드는 뺐다 — 점+색이면 신호가 충분하다.
   점 자체는 aria-hidden 이고, 상태는 행의 접근 이름(aria-label)이 전달한다. */
function UnreadDot() {
  return <span className="size-1.5 flex-none rounded-full bg-primary" aria-hidden="true" />
}

/* ── 공지 행 (목록 행과 같은 grid, 배경만 ov-blue-50) ── */
function NoticeRow({ r, ctx }: { r: BoardRow; ctx: RowCtx }) {
  const { t } = useTranslation()
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => ctx.open(r.id)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && ctx.open(r.id)}
      aria-label={`${t('badge-notice')} · ${r.read ? r.title : `${t('list-filter-unread')} · ${r.title}`}`}
      className={`group relative cursor-pointer bg-ov-blue-50 text-left hover:bg-gray-50 ${ROW}`}
      style={{ gridTemplateColumns: COLS }}
    >
      <span className="flex w-full min-w-0 items-center gap-[7px] min-[631px]:w-auto min-[631px]:pr-3.5">
        <TitleCell r={r} notice={t('badge-notice')} />
      </span>
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
      <RowActions row={r} ctx={ctx} />
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
// canWrite: GET /board/{board} 의 is_writable — 「글쓰기」 CTA 는 쓸 수 있을 때만 뜬다
// (디자인 B-7 확정. 검색·휴지통 빈 상태엔 CTA 자체가 없다)
function EmptyState({ canWrite }: { canWrite: boolean }) {
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
      {canWrite && (
        <Link
          to="/write"
          className="inline-flex h-9 items-center gap-1.5 rounded-[5px] bg-primary px-4 text-[13px] font-semibold text-white hover:bg-ov-blue-700"
        >
          <PlusIcon />
          {t('board-write')}
        </Link>
      )}
    </div>
  )
}

/* ── 행 hover 퀵액션 (북마크 + 링크복사) ── */
function RowActions({ row, ctx }: { row: BoardRow; ctx: RowCtx }) {
  const { t } = useTranslation()
  const marked = row.bookmarked
  return (
    <span className="absolute top-1/2 right-2.5 hidden -translate-y-1/2 items-center gap-0.5 rounded-lg bg-card/95 opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-opacity group-hover:opacity-100 min-[631px]:flex">
      <button
        type="button"
        aria-label={t('nav-favorites')}
        onClick={(e) => {
          e.stopPropagation()
          ctx.onBm(row)
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
// 공지 6a: 목록과 «같은 표» 안에서 상단 3건을 고정하고, 초과분은 토글로 펼친다.
// 공지 블록 전체를 gray-200 한 줄로 일반 목록과 구분한다(디자인 6a).
function BoardView({
  rows,
  ctx,
  notices,
  hiddenCount,
  expanded,
  onToggleNotices,
}: {
  rows: BoardRow[]
  ctx: RowCtx
  notices: BoardRow[]
  hiddenCount: number
  expanded: boolean
  onToggleNotices: () => void
}) {
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
      {notices.length > 0 && (
        <div className="border-b border-gray-200">
          {notices.map((r) => (
            <NoticeRow key={r.id} r={r} ctx={ctx} />
          ))}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={onToggleNotices}
              aria-expanded={expanded}
              className="flex h-[34px] w-full items-center justify-center gap-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-primary"
            >
              {expanded
                ? t('list-notice-collapse')
                : t('list-notice-expand', { n: hiddenCount })}
              <ChevronDownIcon className={expanded ? 'rotate-180' : ''} />
            </button>
          )}
        </div>
      )}
      {rows.map((r) => (
        <div
          key={r.id}
          role="button"
          tabIndex={0}
          onClick={() => ctx.open(r.id)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && ctx.open(r.id)}
          aria-label={r.read ? r.title : `${t('list-filter-unread')} · ${r.title}`}
          className={`group relative cursor-pointer text-left hover:bg-gray-50 ${ROW}`}
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
          <RowActions row={r} ctx={ctx} />
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
          aria-label={r.read ? r.title : `${t('list-filter-unread')} · ${r.title}`}
          className={`group relative flex w-full cursor-pointer gap-4 border-b border-gray-100 px-1 py-5 text-left hover:bg-gray-50 ${r.notice ? 'bg-accent' : ''}`}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex min-w-0 items-center gap-[7px]">
              {!r.read && <UnreadDot />}
              {r.notice && <NoticeBadge label={t('badge-notice')} />}
              <span
                className={`line-clamp-2 text-sm min-[631px]:truncate ${r.read ? 'text-gray-500' : 'text-gray-900'}`}
              >
                {r.title}
              </span>
              {r.comments > 0 && <CommentCount n={r.comments} />}
            </span>
            {/* 모바일은 스니펫을 뺀다 — 제목 2줄 + 메타 한 줄로 압축(디자인 B-4) */}
            <span className="hidden line-clamp-2 text-[12.5px] leading-[1.55] text-gray-500 min-[631px]:block">
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
              className={`inline-flex h-[56px] w-[88px] min-[631px]:h-[76px] min-[631px]:w-[120px] flex-none items-center justify-center rounded-lg text-on-pastel opacity-85 ${r.thumbBg}`}
            >
              <ImageIcon />
            </span>
          )}
          <RowActions row={r} ctx={ctx} />
        </div>
      ))}
    </div>
  )
}

/* ── 앨범형 (공지 포함 그리드) ── */
function AlbumView({ rows, ctx }: { rows: BoardRow[]; ctx: RowCtx }) {
  const { t } = useTranslation()
  // 모바일 2열 고정(gap 10px) → 데스크톱 auto-fill (디자인 B-4)
  return (
    <div className="grid grid-cols-2 gap-2.5 min-[631px]:grid-cols-[repeat(auto-fill,minmax(230px,1fr))] min-[631px]:gap-3.5">
      {rows.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => ctx.open(r.id)}
          aria-label={r.read ? r.title : `${t('list-filter-unread')} · ${r.title}`}
          className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-card text-left hover:shadow-[0_4px_8px_rgba(0,0,0,0.1)]"
        >
          <span
            className={`flex h-[120px] items-center justify-center text-on-pastel opacity-90 ${r.thumbBg}`}
          >
            <ImageIcon large />
          </span>
          <span className="flex flex-col gap-1.5 px-3.5 pt-3 pb-3.5">
            <span className="flex min-w-0 items-center gap-1.5">
              {!r.read && <UnreadDot />}
              {r.notice && <NoticeBadge label={t('badge-notice')} />}
              <span
                className={`line-clamp-2 text-[13.5px] min-[631px]:truncate ${r.read ? 'text-gray-500' : 'text-gray-900'}`}
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
      {!r.read && <UnreadDot />}
      {r.notice && <NoticeBadge label={notice} />}
      <span
        className={`truncate text-[13.5px] ${r.read ? 'text-gray-500' : 'text-gray-900'}`}
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
