import { useEffect, useRef, useState } from 'react'

import { useNavigate, useSearch } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import { SearchFilterPanel } from './SearchFilter'
import { SORT_OPTIONS } from './constants'
import {
  activeFilterCount,
  buildFileParams,
  buildPostParams,
  draftOf,
  isQueryReady,
} from './searchParams'
import type { FilterDraft, SearchQuery, SearchTab } from './types'
import { Dropdown } from '@/components/common/Dropdown'
import { Highlight } from '@/components/common/Highlight'
import { Pagination } from '@/components/common/Pagination'
import { Toast } from '@/components/common/Toast'
import {
  ClockIcon,
  CommentIcon,
  DownloadIcon,
  FilterIcon,
  PaperclipIcon,
  SearchIcon,
  XIcon,
} from '@/components/common/icons'
import { useToast } from '@/components/common/useToast'
import { fmtSize } from '@/components/drive/driveData'
import { extBg } from '@/constants/fileExt'
import { useDriveDownload } from '@/hooks/useDriveDownload'
import { useDriveFilePage } from '@/hooks/useDriveFiles'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { useIsMobile } from '@/hooks/useIsMobile'
import { usePosts } from '@/hooks/usePosts'
import { useRecentSearch } from '@/hooks/useRecentSearch'
import type { ApiDriveFile } from '@/types/drive'
import type { Post } from '@/types/post'
import { fmtDate } from '@/utils/date'
import { LIMIT_DEFAULT_DESKTOP, LIMIT_DEFAULT_MOBILE } from '@/utils/listLimit'

const FILTER_PANEL_ID = 'search-filter-panel'

export function SearchScreen() {
  const { t } = useTranslation()
  const search = useSearch({ from: '/search' })
  // `from` 을 주면 search 리듀서의 prev 가 이 라우트 스키마로 좁혀진다 —
  // 안 주면 라우터가 모든 라우트의 search 를 합집합으로 넘겨 `tab` 처럼 이름이
  // 겹치는 키에서 타입이 어긋난다(/settings 도 ?tab= 을 쓴다).
  const navigate = useNavigate({ from: '/search' })
  // URL 이 정본. 기본값은 URL 에 쓰지 않고 여기서 채운다(게시판 목록과 같은 규약).
  const setSearch = (patch: Partial<SearchQuery>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) })

  const isMobile = useIsMobile()
  const perPage = isMobile ? LIMIT_DEFAULT_MOBILE : LIMIT_DEFAULT_DESKTOP
  const tab: SearchTab = search.tab ?? 'posts'
  const page = search.page ?? 1
  const ready = isQueryReady(search.q)
  const filterOpen = search.filter === 1
  const filterCount = activeFilterCount(search)

  const { toast, showToast, hideToast } = useToast()
  const recents = useRecentSearch()
  const [recentOpen, setRecentOpen] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  // 입력창은 «타이핑 중»에만 로컬 상태다. URL 의 q 가 바뀌면(뒤로가기·최근어 클릭) 맞춘다 —
  // effect 로 되돌리면 옛 값이 한 프레임 그려진다 → 렌더 중 파생(React 공식 패턴).
  const urlQ = search.q ?? ''
  const [input, setInput] = useState({ urlQ, value: urlQ })
  if (input.urlQ !== urlQ) setInput({ urlQ, value: urlQ })
  const typed = input.urlQ === urlQ ? input.value : urlQ
  const setTyped = (value: string) => setInput({ urlQ, value })

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setRecentOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // 모바일 무한 스크롤: 페이지를 이어 붙이지 않고 take 를 키워 1페이지로 다시 받는다
  // (게시판 목록과 같은 방식 — 누적 배열·중복 제거·오프셋 밀림이 없다).
  const scope = JSON.stringify({ ...search, page: undefined, tab: undefined })
  const [loaded, setLoaded] = useState({ scope, pages: 1 })
  const loadedPages = loaded.scope === scope ? loaded.pages : 1
  if (loaded.scope !== scope) setLoaded({ scope, pages: 1 })
  const loadMore = () => setLoaded({ scope, pages: loadedPages + 1 })

  // 활성 탭만 페이지·누적을 따르고, 비활성 탭은 카운트용 1페이지만 받는다.
  // Go 에 통합 검색 엔드포인트가 없어 탭 카운트를 각각의 total 로 얻는다.
  const take = isMobile ? perPage * loadedPages : perPage
  const postsActive = tab === 'posts'
  const postParams = buildPostParams(search, postsActive ? take : perPage, postsActive ? page : 1)
  const fileParams = buildFileParams(search, postsActive ? perPage : take, postsActive ? 1 : page)

  const posts = usePosts(postParams, ready)
  // 「본문」 검색은 파일에 본문이 없어 조회하지 않는다(buildFileParams → null).
  const files = useDriveFilePage(fileParams ?? {}, ready && fileParams !== null)

  const postRows = posts.data?.data ?? []
  const fileRows = files.data?.data ?? []
  const postCount = ready ? (posts.data?.total ?? 0) : 0
  const fileCount = ready && fileParams ? (files.data?.total ?? 0) : 0

  const active = postsActive ? posts : files
  const rowCount = postsActive ? postRows.length : fileRows.length
  const totalCount = postsActive ? postCount : fileCount
  const totalPages = (postsActive ? posts.data?.last_page : files.data?.last_page) ?? 1
  const hasMore = isMobile && rowCount < totalCount
  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !active.isFetching)

  const dl = useDriveDownload()
  const [sortOpen, setSortOpen] = useState(false)

  const submit = (raw: string, extra?: Partial<SearchQuery>) => {
    const q = raw.trim()
    if (!isQueryReady(q)) {
      showToast(t('search-min-length'), 'warning')
      return
    }
    recents.add(q)
    setRecentOpen(false)
    setSearch({ q, page: undefined, ...extra })
  }

  // 필터는 「적용」을 눌렀을 때만 URL 에 반영된다. 빠진 키를 지우려면 명시적으로 undefined 를
  // 넘겨야 한다(setSearch 는 이전 쿼리와 병합한다) → draftOf({}) 로 7키를 먼저 비운다.
  const applyFilter = (next: FilterDraft) => setSearch({ ...draftOf({}), ...next, page: undefined })

  // 자료실과 같은 결과 처리. 1건이라 진행률 모달 없이 결과만 알린다(취소도 실패가 아니다).
  const download = async (f: ApiDriveFile) => {
    const r = await dl.start([{ id: f.id, name: f.origin_file_name }], f.origin_file_name)
    if (r === 'unavailable') showToast(t('file-dl-unavailable'), 'error')
    else if (r === 'canceled') showToast(t('drive-dl-canceled'))
    else if (r === 'failed') showToast(t('drive-dl-fail'), 'error')
    else showToast(t('drive-dl-done', { n: 1 }))
  }

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      {/* ── 검색바 ── */}
      <div ref={barRef} className="relative">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit(typed)
          }}
          className={`flex h-12 items-center gap-2.5 rounded-md border bg-card pr-2 pl-3.5 ${typed ? 'border-primary' : 'border-gray-300'}`}
        >
          <SearchIcon />
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onFocus={() => setRecentOpen(true)}
            placeholder={t('nav-search-placeholder')}
            className="min-w-0 flex-1 border-none bg-transparent text-base text-gray-900 outline-none"
          />
          {typed && (
            <button
              type="button"
              aria-label={t('search-clear')}
              onClick={() => {
                setTyped('')
                setRecentOpen(true)
              }}
              className="inline-flex size-[22px] flex-none items-center justify-center rounded-full bg-gray-100 text-gray-500"
            >
              <XIcon className="size-3" />
            </button>
          )}
          {/* 정본은 필터 토글이 검색바 «안»에 있다 — 지우기 X 다음, 「검색」 버튼 앞.
              적용된 조건 수는 배지로 붙는다(sfCount). */}
          <button
            type="button"
            aria-label={t('search-advanced')}
            aria-expanded={filterOpen}
            aria-controls={FILTER_PANEL_ID}
            onClick={() => setSearch({ filter: filterOpen ? undefined : 1 })}
            className={`relative inline-flex h-[34px] w-9 flex-none items-center justify-center rounded-md border ${filterOpen ? 'border-primary bg-ov-blue-50 text-primary' : 'border-gray-200 bg-card text-gray-700 hover:bg-gray-100'}`}
          >
            <FilterIcon />
            {filterCount > 0 && (
              <span
                aria-label={t('search-filter-count', { n: filterCount })}
                className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-lg bg-primary px-[3px] text-2xs font-bold text-white"
              >
                {filterCount}
              </span>
            )}
          </button>
          <button
            type="submit"
            className="inline-flex h-[34px] flex-none items-center rounded-md bg-primary px-[15px] text-sm font-semibold text-white hover:bg-ov-blue-700"
          >
            {t('common-search')}
          </button>
        </form>

        {/* 최근 검색어 — 빈 상태는 정본에 없다 → 목록이 없으면 아예 열지 않는다. */}
        {recentOpen && recents.list.length > 0 && (
          <div className="absolute inset-x-0 top-[calc(100%+4px)] z-[var(--z-dropdown)] rounded-lg border border-gray-200 bg-card p-1.5 shadow-[var(--shadow-dropdown)]">
            <div className="flex h-8 items-center px-2.5 text-xs text-gray-400">
              {t('search-recent')}
              <button
                type="button"
                onClick={recents.clear}
                className="ml-auto text-gray-400 hover:text-destructive"
              >
                {t('search-clear-all')}
              </button>
            </div>
            {recents.list.map((r) => (
              <div
                key={r}
                className="flex h-9 items-center gap-2.5 rounded-md px-2.5 hover:bg-gray-100"
              >
                <ClockIcon />
                <button
                  type="button"
                  onClick={() => submit(r)}
                  className="min-w-0 flex-1 truncate text-left text-sm text-gray-800"
                >
                  {r}
                </button>
                <button
                  type="button"
                  aria-label={`${r} — ${t('search-recent-remove')}`}
                  onClick={() => recents.remove(r)}
                  className="inline-flex size-[22px] flex-none items-center justify-center rounded-md text-gray-300 hover:bg-gray-100 hover:text-gray-600"
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 상세 필터 — 정본은 브레이크포인트마다 «같은» 인라인 패널을 쓴다(모바일도 바텀시트가 아니다). */}
      {filterOpen && (
        <div className="-mt-2.5">
          <SearchFilterPanel id={FILTER_PANEL_ID} value={draftOf(search)} onApply={applyFilter} />
        </div>
      )}

      {ready && (
        <>
          {/* ── 결과 탭 ── */}
          <div
            role="tablist"
            aria-label={t('common-search')}
            className="flex gap-6 border-b border-gray-200"
          >
            <Tab
              tab="posts"
              active={postsActive}
              label={t('search-tab-posts')}
              count={postCount}
              onPick={() => setSearch({ tab: undefined, page: undefined })}
            />
            <Tab
              tab="files"
              active={!postsActive}
              label={t('search-tab-files')}
              count={fileCount}
              onPick={() => setSearch({ tab: 'files', page: undefined })}
            />
          </div>

          {/* 건수는 시각적으로 탭에 있고, 스크린리더에는 갱신을 알린다. */}
          <span className="sr-only" aria-live="polite">
            {t('search-result-live', { posts: postCount, files: fileCount })}
          </span>

          <div className="-mt-2.5 flex items-center justify-end">
            <Dropdown
              label={t(SORT_OPTIONS.find((o) => o.value === (search.order ?? 'relative'))!.key)}
              open={sortOpen}
              onToggle={() => setSortOpen((v) => !v)}
              onClose={() => setSortOpen(false)}
              width="w-[130px]"
              options={SORT_OPTIONS.map((o) => ({
                key: o.value,
                label: t(o.key),
                selected: (search.order ?? 'relative') === o.value,
                onPick: () =>
                  setSearch({
                    order: o.value === 'relative' ? undefined : o.value,
                    page: undefined,
                  }),
              }))}
            />
          </div>

          {/* ── 결과 ── */}
          {active.isError ? (
            <Placeholder text={t('search-error')} onRetry={() => active.refetch()} />
          ) : active.isLoading ? (
            <ResultSkeleton />
          ) : rowCount === 0 ? (
            <Placeholder text={t('search-empty')} sub={t('search-empty-sub')} />
          ) : (
            <>
              <div
                role="tabpanel"
                id={`search-panel-${tab}`}
                aria-labelledby={`search-tab-${tab}`}
                className="overflow-hidden rounded-lg border border-gray-200 bg-card"
              >
                {postsActive
                  ? postRows.map((p) => (
                      <PostRow
                        key={p.id}
                        post={p}
                        q={search.q}
                        onOpen={() => navigate({ to: '/post/$postId', params: { postId: p.id } })}
                      />
                    ))
                  : fileRows.map((f) => (
                      <FileRow key={f.id} file={f} q={search.q} onDownload={() => download(f)} />
                    ))}
              </div>

              {/* 모바일 무한 스크롤 센티널 — 바닥 100px 전에 다음 묶음을 불러온다 */}
              {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />}

              {/* 페이지네이션 — 데스크톱 전용, lastPage>1 일 때만 */}
              {!isMobile && totalPages > 1 && (
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPick={(n) => setSearch({ page: n > 1 ? n : undefined })}
                />
              )}
            </>
          )}
        </>
      )}

      <Toast toast={toast} onClose={hideToast} />
    </div>
  )
}

function Tab({
  tab,
  active,
  label,
  count,
  onPick,
}: {
  tab: SearchTab
  active: boolean
  label: string
  count: number
  onPick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`search-tab-${tab}`}
      aria-selected={active}
      aria-controls={`search-panel-${tab}`}
      tabIndex={active ? 0 : -1}
      onClick={onPick}
      className={`-mb-px border-b-2 px-0.5 pb-2.5 text-sm font-semibold whitespace-nowrap ${active ? 'border-primary text-gray-900' : 'border-transparent text-gray-500'}`}
    >
      {label} <span className={active ? 'text-primary' : 'text-gray-400'}>{count}</span>
    </button>
  )
}

function PostRow({ post, q, onOpen }: { post: Post; q?: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-1.5 border-b border-gray-100 px-[18px] py-4 text-left last:border-b-0 hover:bg-gray-50"
    >
      <span className="text-sm leading-body font-semibold text-gray-900">
        <Highlight text={post.title ?? ''} q={q} />
      </span>
      <span className="line-clamp-2 text-s leading-prose [overflow-wrap:anywhere] text-gray-500">
        <Highlight text={post.text_content} q={q} bold />
      </span>
      <span className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
        {/* ⚠ 게시판 이름은 board.title 이다 — board.name 이 아니다(types/post.ts 경고). */}
        <span className="text-gray-500">{post.board?.title}</span>
        <span>·</span>
        <span>{post.user?.name}</span>
        <span>·</span>
        <span>{fmtDate(post.posted_at ?? post.created_at)}</span>
        {(post.files?.length ?? 0) > 0 && <PaperclipIcon />}
        {post.comment_count > 0 && (
          <span className="inline-flex items-center gap-0.5 font-semibold text-primary">
            <CommentIcon />
            {post.comment_count}
          </span>
        )}
      </span>
    </button>
  )
}

function FileRow({
  file,
  q,
  onDownload,
}: {
  file: ApiDriveFile
  q?: string
  onDownload: () => void
}) {
  const { t } = useTranslation()
  const ext = (file.extension ?? '').toUpperCase()
  return (
    <div className="flex items-center gap-2.5 border-b border-gray-100 px-[18px] py-[13px] last:border-b-0 hover:bg-gray-50">
      <span
        className={`inline-flex h-5 w-10 flex-none items-center justify-center rounded text-2xs font-bold text-on-pastel ${extBg(ext)}`}
      >
        {ext}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="truncate text-sm text-gray-900">
          <Highlight text={file.origin_file_name} q={q} bold />
        </span>
        {/* ⚠ 정본의 「자료실 > 팀 자료」 폴더 경로는 Go 응답에 없다(drive_folder_id 만, 09:56)
            → 게시판 이름으로 대신한다. 백엔드 요청 대장 참조. */}
        <span className="text-xs text-gray-400">
          {t('search-file-meta', {
            board: file.board?.title ?? '',
            author: file.user?.name ?? '',
            date: fmtDate(file.created_at),
            size: fmtSize(file.size),
          })}
        </span>
      </span>
      <button
        type="button"
        aria-label={`${file.origin_file_name} — ${t('file-download')}`}
        onClick={onDownload}
        className="inline-flex size-[30px] flex-none items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
      >
        <DownloadIcon />
      </button>
    </div>
  )
}

/* 결과 없음 · 오류 — 정본의 같은 카드 하나를 쓴다(원 52px + 돋보기 + 2줄). */
function Placeholder({ text, sub, onRetry }: { text: string; sub?: string; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-gray-200 bg-card px-5 py-16">
      <span className="inline-flex size-[52px] items-center justify-center rounded-full bg-ov-blue-50 text-primary">
        <SearchIcon big />
      </span>
      <span className="text-sm text-gray-500">{text}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-8 items-center rounded-md border border-gray-200 bg-card px-3 text-s font-semibold text-gray-700 hover:bg-gray-100"
        >
          {t('common-retry')}
        </button>
      )}
    </div>
  )
}

function ResultSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-card">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-2 border-b border-gray-100 px-[18px] py-4 last:border-b-0"
        >
          <span className="h-4 w-1/2 rounded bg-gray-100" />
          <span className="h-3 w-full rounded bg-gray-100" />
          <span className="h-3 w-1/3 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  )
}
