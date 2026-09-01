import { useNavigate } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import {
  DEFAULT_LIMIT_DAY,
  DRAFT_COUNT,
  EXT_BG,
  EXT_BG_DEFAULT,
  HOME_TAKE,
  NEW_BADGE,
  SCHED_COUNT,
  TODO_PILL,
} from './constants'
import { useDriveFiles } from '@/hooks/useDriveFiles'
import { useMe } from '@/hooks/useMe'
import { usePosts } from '@/hooks/usePosts'
import type { ApiDriveFile } from '@/types/drive'
import type { Post } from '@/types/post'

// 데스크톱은 테이블(웹 정본), 모바일은 테두리 카드 + 한 줄 목록(모바일 정본).
// 가로 스크롤은 쓰지 않는다 — 디자인은 스크롤이 아니라 컬럼을 meta 한 줄로 접는다.
const SECTION_CARD = 'overflow-hidden rounded-lg border border-gray-200 min-[631px]:rounded-none min-[631px]:border-0'
const SECTION_HEAD =
  'flex h-12 items-center gap-2 border-b border-gray-100 px-[18px] min-[631px]:h-11 min-[631px]:border-b-0 min-[631px]:px-1'
const SECTION_TITLE = 'text-lg font-extrabold tracking-[-0.01em]'
// 행: 모바일 flex 한 줄 → 데스크톱 grid 테이블
const ROW =
  'h-[46px] w-full items-center border-b border-gray-100 px-[18px] flex gap-2 min-[631px]:grid min-[631px]:gap-0 min-[631px]:px-1'
const CELL_DESKTOP = 'hidden truncate text-s min-[631px]:block'
const META_MOBILE = 'flex-none truncate text-xs text-gray-400 min-[631px]:hidden'

const COLS_POSTS = 'minmax(0,1fr) 130px 96px 92px 60px 60px'
const COLS_FILES = '52px minmax(0,1fr) 120px 90px 88px 96px'

function fmtDate(s?: string | null) {
  return s ? s.slice(0, 10).replace(/-/g, '.') : ''
}

interface HomePost {
  id: string
  title: string
  board: string
  author: string
  date: string
  views: number
  likes: number
  notice: boolean
  unread: boolean
  comments: number
}
function toHomePost(p: Post): HomePost {
  return {
    id: p.id,
    title: p.title,
    board: p.board?.title ?? '',
    author: p.user?.name ?? '',
    date: fmtDate(p.posted_at ?? p.created_at),
    views: p.view_count,
    likes: p.like_count,
    notice: (p.badges ?? []).some((b) => b.type === 'NOTICE'),
    unread: p.is_view === false, // 서버 is_view($appends) — 없으면 읽음 취급
    comments: p.comment_count,
  }
}

interface HomeFile {
  id: string
  ext: string
  name: string
  folder: string
  uploader: string
  date: string
}
function toHomeFile(f: ApiDriveFile): HomeFile {
  return {
    id: f.id,
    ext: (f.extension ?? '').toUpperCase(),
    name: f.origin_file_name,
    folder: f.board?.title ?? '',
    uploader: f.user?.name ?? '',
    date: fmtDate(f.created_at),
  }
}

export function HomeScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // 홈 목록은 회사 설정 '최신글 노출 기간'으로 창을 좁힌다 — 하단 안내문이 주장하는 그 값.
  const { data: me } = useMe()
  const limitDay = me?.company_setting?.latest_post_day ?? DEFAULT_LIMIT_DAY
  // 로그인 후 홈 진입/새로고침 시 최근 게시글 자동 호출 (인증 상태에서만)
  const { data, isLoading, isError } = usePosts({
    take: HOME_TAKE,
    limit_day: limitDay,
    sort: { by: 'posted_at', order: 'desc' },
  })
  const posts = (data?.data ?? []).map(toHomePost)
  // 홈 진입/새로고침 시 최근 자료(파일)도 자동 호출
  const {
    data: fileData,
    isLoading: filesLoading,
    isError: filesError,
  } = useDriveFiles({
    limit: HOME_TAKE,
    limit_day: limitDay,
    sort: { by: 'created_at', order: 'desc' },
  })
  const files = (fileData ?? []).slice(0, HOME_TAKE).map(toHomeFile)

  return (
    <div className="flex w-full flex-col gap-4">
      <span className="text-lg font-extrabold tracking-[-0.01em]">{t('nav-home')}</span>

      {/* 해야 할 일 */}
      <div className="flex flex-wrap items-center gap-3.5 rounded-lg border border-gray-200 bg-gray-50 px-[18px] py-3.5">
        <span className="inline-flex size-[34px] flex-none items-center justify-center rounded-lg bg-ov-blue-50 text-primary">
          <CheckIcon />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-bold">{t('home-todo-title')}</span>
          <span className="text-xs text-gray-500">{t('home-todo-desc')}</span>
        </div>
        <div className="ml-auto flex flex-none flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => navigate({ to: '/my' })}
            className={TODO_PILL}
          >
            {t('home-draft')}
            <span className="font-bold text-warning">{DRAFT_COUNT}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: '/my' })}
            className={TODO_PILL}
          >
            {t('home-sched')}
            <span className="font-bold text-primary">{SCHED_COUNT}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* 최근 게시글 */}
        <section className={SECTION_CARD}>
          <div className={SECTION_HEAD}>
            <span className={SECTION_TITLE}>{t('home-recent-posts')}</span>
            {/* 노출 기간(limit_day) 안의 글만 조회하므로 목록에 있으면 곧 기간 이내 —
                읽음 여부와 무관하게 무조건 표시한다(디자인 A-2 확정 · 레거시 파리티) */}
            <span className={`${NEW_BADGE} bg-success`}>NEW</span>
            <MoreLink
              label={t('home-more')}
              onClick={() => navigate({ to: '/board/$boardId', params: { boardId: 'notice' } })}
            />
          </div>
          <div>
            <div>
              <div
                className="hidden h-10 items-center border-b border-gray-200 px-1 text-xs text-gray-500 min-[631px]:grid"
                style={{ gridTemplateColumns: COLS_POSTS }}
              >
                <span>{t('col-title')}</span>
                <span>{t('col-location')}</span>
                <span>{t('col-author')}</span>
                <span>{t('col-date')}</span>
                <span className="text-center">{t('col-views')}</span>
                <span className="text-center">{t('col-likes')}</span>
              </div>
              {isLoading ? (
                Array.from({ length: HOME_TAKE }).map((_, i) => (
                  <div
                    key={i}
                    className={ROW}
                    style={{ gridTemplateColumns: COLS_POSTS }}
                  >
                    <span className="h-3.5 flex-1 animate-pulse rounded bg-gray-100" />
                    <span className="hidden h-3 animate-pulse rounded bg-gray-100 min-[631px]:block" />
                    <span className="hidden h-3 animate-pulse rounded bg-gray-100 min-[631px]:block" />
                    <span className="hidden h-3 animate-pulse rounded bg-gray-100 min-[631px]:block" />
                    <span className="hidden h-3 animate-pulse rounded bg-gray-100 min-[631px]:block" />
                    <span className="hidden h-3 animate-pulse rounded bg-gray-100 min-[631px]:block" />
                  </div>
                ))
              ) : isError ? (
                <div className="px-1 py-10 text-center text-s text-gray-400">
                  {t('list-error')}
                </div>
              ) : posts.length === 0 ? (
                <EmptyState message={t('home-posts-empty')}>
                  <DocIcon />
                </EmptyState>
              ) : (
                posts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      navigate({ to: '/post/$postId', params: { postId: String(p.id) } })
                    }
                    aria-label={p.unread ? `${t('list-filter-unread')} · ${p.title}` : p.title}
                    className={`${ROW} text-left hover:bg-gray-50`}
                    style={{ gridTemplateColumns: COLS_POSTS }}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2 min-[631px]:gap-[7px] min-[631px]:pr-3.5">
                      {p.unread && (
                        <span
                          className="size-1.5 flex-none rounded-full bg-primary"
                          aria-hidden="true"
                        />
                      )}
                      {p.notice && (
                        <span className="inline-flex h-[19px] flex-none items-center rounded bg-l-blue px-[7px] text-2xs font-bold text-primary">
                          {t('badge-notice')}
                        </span>
                      )}
                      <span
                        className={`truncate text-sm ${p.unread ? 'text-gray-900' : 'text-gray-500'}`}
                      >
                        {p.title}
                      </span>
                      {p.comments > 0 && (
                        <span className="inline-flex flex-none items-center gap-0.5 text-xs font-semibold text-primary">
                          <CommentIcon />
                          {p.comments}
                        </span>
                      )}
                    </span>
                    <span className={`${CELL_DESKTOP} pr-3 text-gray-500`}>{p.board}</span>
                    <span className={`${CELL_DESKTOP} pr-2 text-gray-600`}>{p.author}</span>
                    <span className={`${CELL_DESKTOP} whitespace-nowrap text-gray-500`}>
                      {p.date}
                    </span>
                    <span className={`${CELL_DESKTOP} text-center text-gray-500`}>
                      {p.views.toLocaleString()}
                    </span>
                    <span className={`${CELL_DESKTOP} text-center text-gray-500`}>{p.likes}</span>
                    {/* 모바일: 위치·작성일을 한 줄로 접는다 (디자인 mobile의 p.meta) */}
                    <span className={META_MOBILE}>
                      {[p.board, p.date].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        {/* 최근 자료 */}
        <section className={SECTION_CARD}>
          <div className={SECTION_HEAD}>
            <span className={SECTION_TITLE}>{t('home-recent-files')}</span>
            {/* 레거시 <ico-new type="drive" /> · 화면 02 모두 조건 없이 노출한다 */}
            <span className={`${NEW_BADGE} bg-primary`}>NEW</span>
            <MoreLink label={t('home-more')} onClick={() => navigate({ to: '/drive' })} />
          </div>
          <div>
            <div>
              <div
                className="hidden h-10 items-center border-b border-gray-200 px-1 text-xs text-gray-500 min-[631px]:grid"
                style={{ gridTemplateColumns: COLS_FILES }}
              >
                <span>{t('col-ext')}</span>
                <span>{t('col-filename')}</span>
                <span>{t('col-location')}</span>
                <span>{t('col-uploader')}</span>
                <span>{t('col-regdate')}</span>
                <span />
              </div>
              {filesLoading ? (
                Array.from({ length: HOME_TAKE }).map((_, i) => (
                  <div
                    key={i}
                    className={ROW}
                    style={{ gridTemplateColumns: COLS_FILES }}
                  >
                    <span className="h-5 w-10 flex-none animate-pulse rounded bg-gray-100" />
                    <span className="h-3.5 flex-1 animate-pulse rounded bg-gray-100" />
                    <span className="hidden h-3 animate-pulse rounded bg-gray-100 min-[631px]:block" />
                    <span className="hidden h-3 animate-pulse rounded bg-gray-100 min-[631px]:block" />
                    <span className="hidden h-3 animate-pulse rounded bg-gray-100 min-[631px]:block" />
                    <span className="hidden min-[631px]:block" />
                  </div>
                ))
              ) : filesError ? (
                <div className="px-1 py-10 text-center text-s text-gray-400">
                  {t('list-error')}
                </div>
              ) : files.length === 0 ? (
                <EmptyState message={t('home-files-empty')}>
                  <DriveIcon />
                </EmptyState>
              ) : (
                files.map((f) => (
                  <div
                    key={f.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate({ to: '/drive' })}
                    onKeyDown={(e) =>
                      (e.key === 'Enter' || e.key === ' ') && navigate({ to: '/drive' })
                    }
                    className={`${ROW} cursor-pointer hover:bg-gray-50`}
                    style={{ gridTemplateColumns: COLS_FILES }}
                  >
                    <span
                      className={`inline-flex h-5 w-10 flex-none items-center justify-center rounded text-2xs font-bold text-on-pastel ${EXT_BG[f.ext] ?? EXT_BG_DEFAULT}`}
                    >
                      {f.ext}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-800 min-[631px]:pr-3.5">
                      {f.name}
                    </span>
                    <span className={`${CELL_DESKTOP} pr-2.5 text-gray-500`}>{f.folder}</span>
                    <span className={`${CELL_DESKTOP} pr-2 text-gray-600`}>{f.uploader}</span>
                    <span className={`${CELL_DESKTOP} whitespace-nowrap text-gray-500`}>
                      {f.date}
                    </span>
                    {/* 모바일: 위치·업로더·등록일을 한 줄로 접는다 (디자인 mobile의 f.meta) */}
                    <span className={META_MOBILE}>
                      {[f.folder, f.uploader, f.date].filter(Boolean).join(' · ')}
                    </span>
                    {/* 미리보기·다운로드는 데스크톱만 (모바일 디자인엔 없다) */}
                    <span className="hidden justify-end gap-0.5 min-[631px]:flex">
                      <button
                        type="button"
                        aria-label={t('file-preview')}
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate({ to: '/drive' })
                        }}
                        className="inline-flex size-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 hover:text-primary"
                      >
                        <EyeIcon />
                      </button>
                      <button
                        type="button"
                        aria-label={t('file-download')}
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate({ to: '/drive' })
                        }}
                        className="inline-flex size-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 hover:text-primary"
                      >
                        <DownloadIcon />
                      </button>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      <span className="text-xs text-gray-400">{t('home-note', { days: limitDay })}</span>
    </div>
  )
}

// 빈 상태 — 디자인: 44px 원(gray-100) + 아이콘(gray-400) + 13px gray-500, 패딩 40/44px.
function EmptyState({ message, children }: { message: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-5 py-10 min-[631px]:py-11">
      <span className="inline-flex size-[52px] items-center justify-center rounded-full bg-gray-100 text-gray-400">
        {children}
      </span>
      <span className="text-s text-gray-500">{message}</span>
    </div>
  )
}

function DocIcon() {
  return (
    <svg
      className="size-[19px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5" />
    </svg>
  )
}

function DriveIcon() {
  return (
    <svg
      className="size-[19px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 13.5L6 5.5h12l2.5 8" />
      <rect x="3.5" y="13.5" width="17" height="5.5" rx="1.5" />
    </svg>
  )
}

function MoreLink({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-auto inline-flex items-center gap-0.5 text-xs text-gray-400 hover:text-primary"
    >
      {label}
      <svg
        className="size-[11px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

function CheckIcon() {
  return (
    <svg
      className="size-[17px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 12.5l5 5 10-11" />
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
function EyeIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  )
}
function DownloadIcon() {
  return (
    <svg
      className="size-3.5"
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
