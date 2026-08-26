import { useNavigate } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import { DRAFT_COUNT, EXT_BG, EXT_BG_DEFAULT, SCHED_COUNT } from './constants'
import { useDriveFiles } from '@/hooks/useDriveFiles'
import { usePosts } from '@/hooks/usePosts'
import type { ApiDriveFile } from '@/types/drive'
import type { Post } from '@/types/post'

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
    board: p.board?.name ?? '',
    author: p.user?.name ?? '',
    date: fmtDate(p.posted_at ?? p.created_at),
    views: p.view_count,
    likes: p.like_count,
    notice: (p.badges ?? []).some((b) => b.type === 'NOTICE'),
    unread: false,
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
    folder: f.board?.name ?? '',
    uploader: f.user?.name ?? '',
    date: fmtDate(f.created_at),
  }
}

export function HomeScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // 로그인 후 홈 진입/새로고침 시 최근 게시글 자동 호출 (인증 상태에서만)
  const { data, isLoading, isError } = usePosts({
    take: 5,
    sort: { by: 'posted_at', order: 'desc' },
  })
  const posts = (data?.data ?? []).map(toHomePost)
  // 홈 진입/새로고침 시 최근 자료(파일)도 자동 호출
  const {
    data: fileData,
    isLoading: filesLoading,
    isError: filesError,
  } = useDriveFiles({ limit: 4, sort: { by: 'created_at', order: 'desc' } })
  const files = (fileData ?? []).slice(0, 4).map(toHomeFile)

  return (
    <div className="flex w-full flex-col gap-4">
      <span className="text-lg font-extrabold tracking-[-0.01em]">{t('nav-home')}</span>

      {/* 해야 할 일 */}
      <div className="flex flex-wrap items-center gap-3.5 rounded-lg border border-ov-blue-200 bg-card px-[18px] py-3.5">
        <span className="inline-flex size-[34px] flex-none items-center justify-center rounded-lg bg-accent text-primary">
          <CheckIcon />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13.5px] font-bold">{t('home-todo-title')}</span>
          <span className="text-xs text-gray-500">{t('home-todo-desc')}</span>
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => navigate({ to: '/my' })}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-l-orange px-3 text-[12.5px] font-semibold text-on-pastel hover:opacity-90"
          >
            {t('home-draft')}
            <span className="font-bold">{DRAFT_COUNT}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: '/my' })}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-l-blue px-3 text-[12.5px] font-semibold text-on-pastel hover:opacity-90"
          >
            {t('home-sched')}
            <span className="font-bold">{SCHED_COUNT}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* 최근 게시글 */}
        <section>
          <div className="flex h-11 items-center gap-2 px-1">
            <span className="text-[14.5px] font-bold">{t('home-recent-posts')}</span>
            <MoreLink
              label={t('home-more')}
              onClick={() => navigate({ to: '/board/$boardId', params: { boardId: 'notice' } })}
            />
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div
                className="grid h-10 items-center border-b border-gray-200 px-1 text-xs text-gray-500"
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
                Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="grid h-[46px] items-center gap-2 border-b border-gray-100 px-1"
                    style={{ gridTemplateColumns: COLS_POSTS }}
                  >
                    <span className="h-3.5 animate-pulse rounded bg-gray-100" />
                    <span className="h-3 animate-pulse rounded bg-gray-100" />
                    <span className="h-3 animate-pulse rounded bg-gray-100" />
                    <span className="h-3 animate-pulse rounded bg-gray-100" />
                    <span className="h-3 animate-pulse rounded bg-gray-100" />
                    <span className="h-3 animate-pulse rounded bg-gray-100" />
                  </div>
                ))
              ) : isError ? (
                <div className="px-1 py-10 text-center text-[13px] text-gray-400">
                  {t('list-error')}
                </div>
              ) : posts.length === 0 ? (
                <div className="px-1 py-10 text-center text-[13px] text-gray-400">
                  {t('list-empty')}
                </div>
              ) : (
                posts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      navigate({ to: '/post/$postId', params: { postId: String(p.id) } })
                    }
                    className="grid h-[46px] w-full items-center border-b border-gray-100 px-1 text-left hover:bg-gray-50"
                    style={{ gridTemplateColumns: COLS_POSTS }}
                  >
                    <span className="flex min-w-0 items-center gap-[7px] pr-3.5">
                      {p.unread && <span className="size-1.5 flex-none rounded-full bg-primary" />}
                      {p.notice && (
                        <span className="inline-flex h-[19px] flex-none items-center rounded bg-l-blue px-[7px] text-[10.5px] font-bold text-primary">
                          {t('badge-notice')}
                        </span>
                      )}
                      <span
                        className={`truncate text-[13.5px] ${p.unread ? 'font-semibold text-gray-900' : 'font-normal text-gray-800'}`}
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
                    <span className="truncate pr-3 text-[12.5px] text-gray-500">{p.board}</span>
                    <span className="truncate pr-2 text-[12.5px] text-gray-600">{p.author}</span>
                    <span className="text-[12.5px] whitespace-nowrap text-gray-500">{p.date}</span>
                    <span className="text-center text-[12.5px] text-gray-500">
                      {p.views.toLocaleString()}
                    </span>
                    <span className="text-center text-[12.5px] text-gray-500">{p.likes}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        {/* 최근 자료 */}
        <section>
          <div className="flex h-11 items-center gap-2 px-1">
            <span className="text-[14.5px] font-bold">{t('home-recent-files')}</span>
            <MoreLink label={t('home-more')} onClick={() => navigate({ to: '/drive' })} />
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[620px]">
              <div
                className="grid h-10 items-center border-b border-gray-200 px-1 text-xs text-gray-500"
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
                Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="grid h-[46px] items-center gap-2 border-b border-gray-100 px-1"
                    style={{ gridTemplateColumns: COLS_FILES }}
                  >
                    <span className="h-5 w-10 animate-pulse rounded bg-gray-100" />
                    <span className="h-3.5 animate-pulse rounded bg-gray-100" />
                    <span className="h-3 animate-pulse rounded bg-gray-100" />
                    <span className="h-3 animate-pulse rounded bg-gray-100" />
                    <span className="h-3 animate-pulse rounded bg-gray-100" />
                    <span />
                  </div>
                ))
              ) : filesError ? (
                <div className="px-1 py-10 text-center text-[13px] text-gray-400">
                  {t('list-error')}
                </div>
              ) : files.length === 0 ? (
                <div className="px-1 py-10 text-center text-[13px] text-gray-400">
                  {t('drive-empty')}
                </div>
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
                    className="grid h-[46px] cursor-pointer items-center border-b border-gray-100 px-1 hover:bg-gray-50"
                    style={{ gridTemplateColumns: COLS_FILES }}
                  >
                    <span
                      className={`inline-flex h-5 w-10 flex-none items-center justify-center rounded text-[10px] font-bold text-on-pastel ${EXT_BG[f.ext] ?? EXT_BG_DEFAULT}`}
                    >
                      {f.ext}
                    </span>
                    <span className="truncate pr-3.5 text-[13.5px] text-gray-800">{f.name}</span>
                    <span className="truncate pr-2.5 text-[12.5px] text-gray-500">{f.folder}</span>
                    <span className="truncate pr-2 text-[12.5px] text-gray-600">{f.uploader}</span>
                    <span className="text-[12.5px] whitespace-nowrap text-gray-500">{f.date}</span>
                    <span className="flex justify-end gap-0.5">
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

      <span className="text-xs text-gray-400">{t('home-note')}</span>
    </div>
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
