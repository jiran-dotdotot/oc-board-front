import { useEffect, useState } from 'react'

import { Link } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import { ATTACHMENTS, COMMENTS, LIKERS, POST, REACTIONS } from './detailData'
import type { DetailComment } from './detailData'

export function PostDetailScreen() {
  const { t } = useTranslation()
  const [liked, setLiked] = useState(true)
  const [likeCount, setLikeCount] = useState(POST.likeCount)
  const [bookmarked, setBookmarked] = useState(false)
  const [draft, setDraft] = useState('')
  const [menuId, setMenuId] = useState<number | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [likersOpen, setLikersOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setViewerOpen(false)
        setDeleteOpen(false)
        setLikersOpen(false)
        setMenuId(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const toggleLike = () => {
    setLikeCount((c) => (liked ? c - 1 : c + 1))
    setLiked((v) => !v)
  }

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-4">
      {/* 상단: 목록 / 이전·다음 */}
      <div className="flex items-center gap-2">
        <Link
          to="/board/$boardId"
          params={{ boardId: 'notice' }}
          className="inline-flex h-[34px] items-center gap-1.5 rounded-[5px] bg-gray-100 px-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-200"
        >
          <ChevronIcon dir="left" />
          {t('detail-to-list')}
        </Link>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            className="inline-flex h-[34px] items-center gap-1.5 rounded-[5px] px-3 text-[13px] text-gray-600 hover:bg-gray-100"
          >
            <ArrowIcon dir="up" />
            {t('detail-prev')}
          </button>
          <button
            type="button"
            className="inline-flex h-[34px] items-center gap-1.5 rounded-[5px] px-3 text-[13px] text-gray-600 hover:bg-gray-100"
          >
            <ArrowIcon dir="down" />
            {t('detail-next')}
          </button>
        </div>
      </div>

      {/* 본문 카드 */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-card">
        <div className="px-7 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            {POST.notice && (
              <span className="inline-flex h-[22px] flex-none items-center rounded bg-l-blue px-2 text-[11px] font-bold text-primary">
                {t('badge-notice')}
              </span>
            )}
            <span className="text-[12.5px] text-gray-400">{POST.board}</span>
          </div>
          <h1 className="text-wrap-pretty mt-2.5 text-[22px] leading-[1.4] font-extrabold tracking-[-0.01em]">
            {POST.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2.5 border-b border-gray-100 pb-[18px]">
            <span className="inline-flex size-9 flex-none items-center justify-center rounded-full bg-l-green text-sm font-bold text-on-pastel">
              {POST.authorInitial}
            </span>
            <div className="flex min-w-0 flex-col gap-px">
              <span className="text-[13.5px] font-semibold">{POST.author}</span>
              <span className="text-xs text-gray-400">{POST.meta}</span>
            </div>
            <div className="ml-auto flex flex-none gap-0.5">
              <IconBtn label={t('detail-copy-link')}>
                <LinkIcon />
              </IconBtn>
              <IconBtn
                label={t('nav-favorites')}
                onClick={() => setBookmarked((v) => !v)}
                active={bookmarked}
              >
                <BookmarkIcon filled={bookmarked} />
              </IconBtn>
              <IconBtn label={t('detail-print')}>
                <PrintIcon />
              </IconBtn>
              <IconBtn label={t('common-edit')}>
                <EditIcon />
              </IconBtn>
              <IconBtn label={t('common-delete')} danger onClick={() => setDeleteOpen(true)}>
                <TrashIcon />
              </IconBtn>
            </div>
          </div>
        </div>

        {/* 본문 */}
        <div className="px-7 pt-6 pb-2 text-[14.5px] leading-[1.75] text-gray-800">
          <p className="mb-4">{POST.paragraphs[0]}</p>
          <p className="mb-4">{POST.paragraphs[1]}</p>
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            className={`relative my-5 flex h-[240px] w-full max-w-[520px] cursor-zoom-in items-center justify-center rounded-lg text-on-pastel ${POST.imageBg}`}
          >
            <ImageIcon size={34} />
            <span className="absolute right-3 bottom-2.5 inline-flex h-6 items-center gap-1.5 rounded-[5px] bg-black/45 px-2.5 text-[11.5px] text-white">
              <ZoomIcon />
              {t('detail-click-zoom')}
            </span>
          </button>
          <p className="mb-4">{POST.paragraphs[2]}</p>
        </div>

        {/* 첨부 */}
        <div className="px-7 pb-[22px]">
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <div className="flex h-[38px] items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-3.5 text-[12.5px] font-semibold text-gray-600">
              <PaperclipIcon />
              {t('detail-attachments', { n: ATTACHMENTS.length })}
            </div>
            {ATTACHMENTS.map((f, i) => (
              <div
                key={f.name}
                className={`flex h-11 items-center gap-2.5 px-3.5 ${i < ATTACHMENTS.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <span
                  className={`inline-flex h-5 w-10 flex-none items-center justify-center rounded text-[10px] font-bold text-on-pastel ${f.bg}`}
                >
                  {f.ext}
                </span>
                <span className="flex-1 truncate text-[13px] text-gray-800">{f.name}</span>
                <span className="flex-none text-[11.5px] text-gray-400">{f.size}</span>
                <IconBtn small label={t('file-preview')} onClick={() => setViewerOpen(true)}>
                  <EyeIcon />
                </IconBtn>
                <IconBtn small label={t('file-download')}>
                  <DownloadIcon />
                </IconBtn>
              </div>
            ))}
          </div>
        </div>

        {/* 공감 */}
        <div className="flex flex-wrap items-center gap-2 px-7 pb-[26px]">
          <button
            type="button"
            onClick={toggleLike}
            className={`inline-flex h-[34px] items-center gap-1.5 rounded-full border px-[13px] text-[13px] font-semibold ${liked ? 'border-primary bg-accent text-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-100'}`}
          >
            <HeartIcon filled={liked} />
            {likeCount}
          </button>
          {REACTIONS.map((r) => (
            <button
              key={r.emoji}
              type="button"
              className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-gray-200 px-[13px] text-[13px] text-gray-600 hover:bg-gray-100"
            >
              {r.emoji} {r.count}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setLikersOpen(true)}
            className="ml-auto inline-flex items-center gap-1 text-[12.5px] text-gray-400 hover:text-primary"
          >
            {t('detail-view-likers')}
            <ChevronIcon dir="right" small />
          </button>
        </div>
      </div>

      {/* 댓글 카드 */}
      <div className="rounded-lg border border-gray-200 bg-card px-7 pt-[22px] pb-[26px]">
        <span className="text-[14.5px] font-bold">
          {t('detail-comments')} <span className="text-primary">{COMMENTS.length}</span>
        </span>
        <div className="mt-3.5 flex gap-2.5">
          <span className="inline-flex size-8 flex-none items-center justify-center rounded-full bg-l-blue text-[12.5px] font-bold text-on-pastel">
            김
          </span>
          <div className="flex flex-1 flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('detail-comment-ph')}
              className={`min-h-16 w-full resize-y rounded-[5px] border bg-card px-3 py-2.5 text-[13.5px] leading-[1.6] outline-none focus:border-primary ${draft ? 'border-primary' : 'border-gray-300'}`}
            />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!draft.trim()}
                onClick={() => setDraft('')}
                className="inline-flex h-[34px] items-center rounded-[5px] bg-primary px-4 text-[13px] font-semibold text-white disabled:bg-gray-100 disabled:text-gray-300"
              >
                {t('detail-register')}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col">
          {COMMENTS.map((c) => (
            <CommentItem
              key={c.id}
              c={c}
              menuId={menuId}
              onMenu={(id) => setMenuId((cur) => (cur === id ? null : id))}
              onDelete={() => {
                setMenuId(null)
                setDeleteOpen(true)
              }}
            />
          ))}
        </div>
      </div>

      {/* 라이트박스 */}
      {viewerOpen && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex cursor-zoom-out items-center justify-center bg-black/[0.78]"
          onClick={() => setViewerOpen(false)}
          role="presentation"
        >
          <div className="absolute top-3.5 right-3.5 flex gap-1.5">
            <span className="inline-flex size-[34px] items-center justify-center rounded-lg bg-white/15 text-white">
              <DownloadIcon />
            </span>
            <span className="inline-flex size-[34px] items-center justify-center rounded-lg bg-white/15 text-white">
              <CloseIcon />
            </span>
          </div>
          <span
            className={`flex h-[64%] w-[min(60%,560px)] items-center justify-center rounded-lg text-on-pastel ${POST.imageBg}`}
          >
            <ImageIcon size={44} />
          </span>
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[12.5px] text-white/85">
            1 / 2
          </span>
        </div>
      )}

      {/* 삭제 확인 */}
      {deleteOpen && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/50">
          <div className="flex w-80 flex-col items-center gap-2 rounded-lg bg-card px-[22px] pt-[26px] pb-[18px] shadow-[0_4px_18px_rgba(75,70,92,0.1)]">
            <span className="text-center text-[14.5px] font-semibold text-gray-900">
              {t('detail-delete-confirm')}
            </span>
            <span className="text-[12.5px] text-gray-500">{t('detail-delete-sub')}</span>
            <div className="mt-2.5 flex w-full gap-2">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-[5px] border border-gray-200 bg-card text-sm font-semibold text-gray-800 hover:bg-gray-100"
              >
                {t('common-cancel')}
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-[5px] bg-destructive text-sm font-semibold text-white hover:opacity-90"
              >
                {t('common-delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공감 내역 */}
      {likersOpen && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/50">
          <div className="flex max-h-[80vh] w-[340px] flex-col overflow-hidden rounded-lg bg-card shadow-[0_4px_18px_rgba(75,70,92,0.1)]">
            <div className="flex h-[52px] items-center border-b border-gray-100 px-[18px]">
              <span className="text-[14.5px] font-bold">
                {t('detail-likers-title')} <span className="text-primary">{POST.likersCount}</span>
              </span>
              <button
                type="button"
                aria-label={t('common-cancel')}
                onClick={() => setLikersOpen(false)}
                className="ml-auto inline-flex size-[30px] items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="overflow-y-auto p-2">
              {LIKERS.map((u) => (
                <div
                  key={u.name}
                  className="flex h-[46px] items-center gap-2.5 rounded-lg px-2.5 hover:bg-gray-50"
                >
                  <span
                    className={`inline-flex size-[30px] flex-none items-center justify-center rounded-full text-xs font-bold text-on-pastel ${u.bg}`}
                  >
                    {u.initial}
                  </span>
                  <div className="flex min-w-0 flex-col gap-px">
                    <span className="text-[13px] font-semibold">{u.name}</span>
                    <span className="truncate text-[11.5px] text-gray-400">{u.dept}</span>
                  </div>
                  <span className="ml-auto text-sm">{u.emoji}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CommentItem({
  c,
  menuId,
  onMenu,
  onDelete,
  reply,
}: {
  c: DetailComment
  menuId: number | null
  onMenu: (id: number) => void
  onDelete: () => void
  reply?: boolean
}) {
  const { t } = useTranslation()
  return (
    <>
      <div
        className={`flex gap-2.5 border-t border-gray-100 py-3.5 ${reply ? 'ml-3 rounded-lg bg-gray-50 pr-3 pl-3.5' : ''}`}
      >
        {reply && <ReplyArrow />}
        <span
          className={`inline-flex ${reply ? 'size-[30px]' : 'size-8'} mt-px flex-none items-center justify-center rounded-full text-[12.5px] font-bold text-on-pastel ${c.avatarBg}`}
        >
          {c.initial}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold">{c.author}</span>
            <span className="text-[11.5px] text-gray-400">{c.time}</span>
            {c.own && (
              <div className="relative ml-auto">
                <button
                  type="button"
                  aria-label="⋮"
                  onClick={() => onMenu(c.id)}
                  className={`inline-flex size-7 items-center justify-center rounded-[5px] text-gray-400 hover:bg-gray-100 ${menuId === c.id ? 'bg-gray-100' : ''}`}
                >
                  <DotsIcon />
                </button>
                {menuId === c.id && (
                  <div className="absolute top-[calc(100%+4px)] right-0 z-[var(--z-dropdown)] w-[150px] rounded-lg border border-gray-200 bg-card p-1 shadow-[0_4px_8px_rgba(0,0,0,0.1)]">
                    <MenuRow icon={<EditIcon />} label={t('common-edit')} />
                    <MenuRow icon={<HeartIcon />} label={t('detail-like-history')} />
                    <button
                      type="button"
                      onClick={onDelete}
                      className="flex h-[34px] w-full items-center gap-2 rounded-md px-2.5 text-[13px] text-destructive hover:bg-l-red"
                    >
                      <TrashIcon />
                      {t('common-delete')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <span className="text-[13.5px] leading-[1.65] text-gray-800">{c.text}</span>
          {!reply && (
            <div className="mt-0.5 flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-primary"
              >
                <HeartIcon small />
                {c.likes}
              </button>
              <button type="button" className="text-xs text-gray-400 hover:text-primary">
                {t('detail-reply')}
              </button>
            </div>
          )}
        </div>
      </div>
      {c.replies?.map((r) => (
        <CommentItem key={r.id} c={r} menuId={menuId} onMenu={onMenu} onDelete={onDelete} reply />
      ))}
    </>
  )
}

function IconBtn({
  children,
  label,
  onClick,
  danger,
  active,
  small,
}: {
  children: React.ReactNode
  label: string
  onClick?: () => void
  danger?: boolean
  active?: boolean
  small?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`inline-flex ${small ? 'size-[30px]' : 'size-[34px]'} flex-none items-center justify-center rounded-lg ${
        active ? 'text-primary' : 'text-gray-500'
      } ${danger ? 'hover:bg-l-red hover:text-destructive' : 'hover:bg-gray-100'}`}
    >
      {children}
    </button>
  )
}

function MenuRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      className="flex h-[34px] w-full items-center gap-2 rounded-md px-2.5 text-[13px] text-gray-800 hover:bg-gray-100"
    >
      {icon}
      {label}
    </button>
  )
}

/* ── 아이콘 ── */
function ChevronIcon({ dir, small }: { dir: 'left' | 'right'; small?: boolean }) {
  return (
    <svg
      className={small ? 'size-[11px]' : 'size-3.5'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {dir === 'left' ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
    </svg>
  )
}
function ArrowIcon({ dir }: { dir: 'up' | 'down' }) {
  return (
    <svg
      className="size-[13px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {dir === 'up' ? (
        <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />
      ) : (
        <path d="M12 5v14M5.5 12.5L12 19l6.5-6.5" />
      )}
    </svg>
  )
}
function LinkIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.5 13.5a4 4 0 0 0 5.7 0l3.3-3.3a4 4 0 0 0-5.7-5.7l-1.6 1.6" />
      <path d="M13.5 10.5a4 4 0 0 0-5.7 0l-3.3 3.3a4 4 0 0 0 5.7 5.7l1.6-1.6" />
    </svg>
  )
}
function BookmarkIcon({ filled }: { filled?: boolean }) {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.5 3.5h11V21L12 17l-5.5 4z" />
    </svg>
  )
}
function PrintIcon() {
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
      <path d="M7 8.5V3.5h10v5" />
      <path d="M7 17.5H4.5v-7a1.5 1.5 0 0 1 1.5-1.5h12a1.5 1.5 0 0 1 1.5 1.5v7H17" />
      <rect x="7" y="14.5" width="10" height="6" />
    </svg>
  )
}
function EditIcon() {
  return (
    <svg
      className="size-[14px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 15.5V20h4.5L19 9.5 14.5 5z" />
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg
      className="size-[14px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  )
}
function HeartIcon({ filled, small }: { filled?: boolean; small?: boolean }) {
  return (
    <svg
      className={small ? 'size-3' : 'size-[15px]'}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20.5s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3.5c0 5.4-7.5 10-7.5 10z" />
    </svg>
  )
}
function PaperclipIcon() {
  return (
    <svg
      className="size-[13px]"
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
function EyeIcon() {
  return (
    <svg
      className="size-[15px]"
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
function ImageIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      className="opacity-75"
      aria-hidden="true"
    >
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M3.5 16.5l5-4.5 4 3.5 3.5-3 4.5 4" />
    </svg>
  )
}
function ZoomIcon() {
  return (
    <svg
      className="size-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M15.8 15.8L21 21M11 8.5v5M8.5 11h5" />
    </svg>
  )
}
function DotsIcon() {
  return (
    <svg className="size-[15px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5.5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="18.5" r="1.6" />
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg
      className="size-[15px]"
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
function ReplyArrow() {
  return (
    <svg
      className="mt-2 size-[15px] flex-none text-gray-300"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 5v6a4 4 0 0 0 4 4h10" />
      <path d="M14 10l5 5-5 5" />
    </svg>
  )
}
