import { useEffect, useMemo, useRef, useState } from 'react'

import { Link, useNavigate, useParams } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import { PostAttachments } from './PostAttachments'
import { PostComments } from './PostComments'
import { type HistoryTarget, PostHistoryModal } from './PostHistoryModal'
import { PostReactions } from './PostReactions'
import { Avatar } from '@/components/common/Avatar'
import { BlockedModal } from '@/components/common/BlockedModal'
import { FilePreviewModal } from '@/components/common/FilePreviewModal'
import { Modal } from '@/components/common/Modal'
import { NoticeBadge } from '@/components/common/NoticeBadge'
import { Toast } from '@/components/common/Toast'
import {
  BookmarkIcon,
  ChevronIcon,
  CloseIcon,
  EyeIcon,
  LinkIcon,
  PrintIcon,
  TrashIcon,
} from '@/components/common/icons'
import { useToast } from '@/components/common/useToast'
import { useDownloadProgress, useDriveDownload } from '@/hooks/useDriveDownload'
import { useMe } from '@/hooks/useMe'
import { DELETE_REJECTED, usePostDetail, usePostDetailMutations } from '@/hooks/usePostDetail'
import { isAuthenticated } from '@/lib/authStorage'
import { getAttachmentDownloadUrl } from '@/services/driveService'
import type { PostComment, PostFile } from '@/types/post'
import { fmtDateTime } from '@/utils/date'
import { type PreviewKind, previewKind } from '@/utils/filePreview'
import { deviceDefaultLimit, readStoredLimit } from '@/utils/listLimit'
import { reactionTotal } from '@/utils/postComments'
import { blockedKind, listPage } from '@/utils/postDetailState'
import { sanitizePostHtml } from '@/utils/postHtml'

const ICON_BTN =
  'inline-flex size-8 flex-none items-center justify-center rounded-md text-gray-500 hover:bg-gray-100'
const NAV_BTN =
  'inline-flex size-9 flex-none items-center justify-center rounded-md border border-gray-200 bg-card box-border'

export function PostDetailScreen() {
  const { t } = useTranslation()
  const { postId } = useParams({ from: '/post/$postId' })
  const navigate = useNavigate()
  const { data: me } = useMe()
  const { toast, showToast, hideToast } = useToast()

  const { data: post, isLoading, isError, error, refetch } = usePostDetail(postId)
  const m = usePostDetailMutations(postId)
  const dl = useDriveDownload()

  const [delOpen, setDelOpen] = useState(false)
  const [delComment, setDelComment] = useState<PostComment | null>(null)
  const [history, setHistory] = useState<HistoryTarget | null>(null)
  // 진행 중 다운로드를 «확인 없이» 끊지 않는다 — 자료실과 같은 규약(DriveScreen dlCancelAsk).
  const [dlCancelAsk, setDlCancelAsk] = useState(false)
  // 미리보기 — 자료실과 같은 창·같은 규약. 대상 파일을 그대로 들고 있는다.
  const [preview, setPreview] = useState<{ url: string; kind: PreviewKind; file: PostFile } | null>(
    null,
  )
  // 댓글을 지우면 삭제 버튼째로 사라져 초점이 body 로 떨어진다 → 「댓글 N」 제목으로 되돌린다.
  const commentHeading = useRef<HTMLSpanElement | null>(null)

  const status = (error as { response?: { status?: number } } | null)?.response?.status
  const kind = blockedKind(status, post?.state)
  const blocked =
    kind === 'not-found'
      ? t('detail-not-found')
      : kind === 'forbidden'
        ? t('detail-no-permission')
        : null

  // 열람할 수 없는 글이면 게시판(모르면 홈)으로 돌려보낸다. 레거시는 최근글 라우트에서
  // boardId 가 없어 리다이렉트가 해석되지 않았다 — board_id 는 상세 응답 기본 컬럼이라 여기선 안전하다.
  const leave = () => {
    if (post?.board_id) void navigate({ to: '/board/$boardId', params: { boardId: post.board_id } })
    else void navigate({ to: '/' })
  }

  const attachments = post?.files ?? []
  // ⚠ 이 프로젝트엔 React Compiler 가 «없다»(vite.config.ts 플러그인 3개뿐,
  //   babel-plugin-react-compiler 미설치). 앞서 근거로 삼았던 lint 오류는
  //   eslint-plugin-react-hooks@7 의 «컴파일러 린트» 규칙이었을 뿐 빌드 변환이 아니다.
  //   메모 없이 두면 다운로드 진행률처럼 잦은 리렌더마다 본문 전체를 다시 살균한다.
  //   의존성을 지역 변수로 고정해야 preserve-manual-memoization 규칙과 어긋나지 않는다.
  const content = post?.content
  const html = useMemo(() => (content ? sanitizePostHtml(content) : ''), [content])
  // ⚠ `is_active` 를 봐야 한다 — 기간이 끝난 뱃지도 행은 남아 있어서(docs/api/05:236 「각 is_active」)
  //   그냥 type 만 보면 목록에선 일반글인데 상세에선 공지로 갈린다(목록은 서버가 필터한다).
  //   필드가 안 온 경우(undefined)는 유효로 본다 — 목록 응답엔 계산 필드가 없을 수 있다.
  const isNotice = (post?.badges ?? []).some((b) => b.type === 'NOTICE' && b.is_active !== false)
  const busy =
    m.addComment.isPending ||
    m.editComment.isPending ||
    m.removeComment.isPending ||
    m.reactPost.isPending ||
    m.reactComment.isPending

  // ESC 우선순위 — 위에 뜬 것부터 하나씩 닫는다(한 번에 셋을 닫아 버리지 않게).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (delComment) return setDelComment(null)
      if (delOpen) return setDelOpen(false)
      // 다운로드 중이면 ESC 는 «취소 확인»을 띄운다. 바로 끊지 않는다.
      if (dlCancelAsk) return setDlCancelAsk(false)
      if (dl.open) return setDlCancelAsk(true)
      if (preview) return setPreview(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [delComment, delOpen, dlCancelAsk, dl.open, preview])

  const openPreview = async (f: PostFile) => {
    const kind = previewKind(f.extension ?? '')
    if (kind === 'none') return showToast(t('drive-preview-unsupported'))
    try {
      const issued = await getAttachmentDownloadUrl(f.id)
      setPreview({ url: issued.url, kind, file: f })
    } catch {
      showToast(t('file-dl-unavailable'), 'error')
    }
  }

  const download = async (files: PostFile[]) => {
    if (files.length === 0) return
    const zipName = post?.title || t('detail-att-title')
    const r = await dl.start(
      files.map((f) => ({ id: f.id, name: f.origin_file_name })),
      zipName,
      'post',
    )
    if (r === 'unavailable') showToast(t('file-dl-unavailable'), 'error')
    else if (r === 'failed') showToast(t('detail-dl-failed'), 'error')
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      showToast(t('common-link-copied'))
    } catch {
      showToast(t('detail-copy-failed'), 'error')
    }
  }

  // ⚠ isPending 이 아니라 isLoading 이다 — 토큰이 없으면 쿼리를 끄는데(enabled=false)
  //   «끈» 쿼리는 status='pending' 으로 남아 로딩 화면에 영구히 갇힌다.
  if (isLoading) {
    return <p className="p-8 text-center text-sm text-gray-500">{t('common-loading')}</p>
  }

  // 라우트 가드가 없어 공유 링크로 바로 들어올 수 있다. 요청 자체가 안 나가므로
  // apiClient 의 401 리다이렉트도 걸리지 않는다 → 여기서 직접 안내한다.
  if (!isAuthenticated()) {
    return (
      <div className="flex flex-col items-center gap-3 p-8">
        <p className="text-sm text-gray-700">{t('detail-login-required')}</p>
        <Link
          to="/login"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-s font-semibold text-white hover:bg-ov-blue-700"
        >
          {t('detail-go-login')}
        </Link>
      </div>
    )
  }

  if (blocked) {
    return <BlockedModal message={blocked} onClose={leave} />
  }

  if (isError || !post) {
    return (
      <div className="flex flex-col items-center gap-3 p-8">
        <p className="text-sm text-gray-700">{t('detail-load-failed')}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="h-9 rounded-md border border-gray-200 bg-card px-4 text-s font-semibold text-gray-800 hover:bg-gray-100"
        >
          {t('common-retry')}
        </button>
      </div>
    )
  }

  const author = post.user?.name ?? undefined
  const total = reactionTotal(post.likes)

  return (
    <div className="flex w-full flex-col gap-2.5">
      {/* 목록 / 이전·다음 — 정본 :486-492. 이전/다음 id 는 상세 응답이 준다(별도 API 없음) */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link
          to="/board/$boardId"
          params={{ boardId: post.board_id }}
          search={{ page: listPage(post.row_num, readStoredLimit() ?? deviceDefaultLimit()) }}
          className="box-border inline-flex h-9 items-center rounded-md border border-gray-200 bg-card px-[15px] text-s font-semibold text-gray-800 hover:bg-gray-100"
        >
          {t('detail-to-list')}
        </Link>
        <div className="ml-auto flex gap-1.5">
          <NavBtn
            to={post.prev_post_id}
            label={t('detail-prev')}
            reason={t('detail-prev-none')}
            dir="left"
          />
          <NavBtn
            to={post.next_post_id}
            label={t('detail-next')}
            reason={t('detail-next-none')}
            dir="right"
          />
        </div>
      </div>

      <article className="flex flex-col bg-card">
        {/* 머리 — 뱃지·게시판명·제목·작성자·액션 (정본 :495-521) */}
        {/* 정본 패딩: 모바일 10/2/18 → 데스크톱 10/4/20 */}
        <header className="flex flex-col gap-3.5 border-b border-gray-200 px-0.5 pt-2.5 pb-[18px] min-[631px]:px-1 min-[631px]:pb-5">
          <div className="flex flex-wrap items-center gap-2">
            {isNotice && <NoticeBadge />}
            <span className="text-s text-gray-400">{post.board?.title ?? ''}</span>
          </div>
          {/* 정본 20px/800 (개선안 통합 앱 isDetail 블록). 24px 은 전용 아트보드 화면 04 값이라 여기선 안 쓴다. */}
          <h1 className="text-[20px] leading-title font-extrabold tracking-title text-pretty break-words">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2.5">
            <Avatar name={author ?? undefined} size="size-[34px]" />
            <div className="flex min-w-0 flex-col gap-px">
              <span className="text-s font-semibold">{author ?? '-'}</span>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                <span>{fmtDateTime(post.posted_at ?? post.created_at)}</span>
                <button
                  type="button"
                  onClick={() => setHistory({ postId, likes: post.likes ?? [], tab: 'views' })}
                  aria-label={t('detail-history-open', { n: post.view_count })}
                  className="inline-flex items-center gap-[3px] hover:text-primary"
                >
                  <EyeIcon className="size-3" />
                  {post.view_count}
                </button>
                <button
                  type="button"
                  onClick={() => setHistory({ postId, likes: post.likes ?? [], tab: 'likes' })}
                  aria-label={t('detail-react-total', { n: total })}
                  className="inline-flex items-center gap-[3px] hover:text-primary"
                >
                  <SmileIcon />
                  {total}
                </button>
              </div>
            </div>

            <div className="ml-auto flex flex-none gap-0.5 print:hidden">
              <button
                type="button"
                onClick={() => void copyLink()}
                aria-label={t('detail-copy-link')}
                className={ICON_BTN}
              >
                <LinkIcon className="size-[15px]" />
              </button>
              <button
                type="button"
                onClick={() =>
                  m.bookmark.mutate(undefined, {
                    onError: () => showToast(t('detail-bookmark-failed'), 'error'),
                  })
                }
                disabled={m.bookmark.isPending}
                aria-pressed={!!post.is_bookmark}
                aria-label={t(post.is_bookmark ? 'detail-bookmark-on' : 'detail-bookmark-off')}
                className={`${ICON_BTN} ${post.is_bookmark ? 'text-primary' : ''}`}
              >
                <BookmarkIcon className="size-[15px] flex-none" filled={!!post.is_bookmark} />
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                aria-label={t('detail-print')}
                className={ICON_BTN}
              >
                <PrintIcon className="size-[15px]" />
              </button>
              {/* 수정 진입점은 «게시글 수정 기능이 구현될 때» 되살린다.
                  /write 는 search 를 읽지 않는 새 글 폼이고 저장 mutation 자체가 없어,
                  연필을 누르면 빈 종이가 뜨고 다시 쓴 내용도 저장되지 않는다.
                  수정은 «작성자 본인만» — 관리자도 서버가 403 을 준다(docs/api/go/06-post-write.md:169). */}
              {/* 삭제는 작성자 «또는» 관리자(06:204) */}
              {(post.is_mine || post.is_admin) && (
                <button
                  type="button"
                  onClick={() => setDelOpen(true)}
                  aria-label={t('common-delete')}
                  className="inline-flex size-8 flex-none items-center justify-center rounded-md text-destructive hover:bg-destructive-bg"
                >
                  <TrashIcon className="size-[15px]" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* 본문 · 첨부 · 공감 (정본 :523-557) */}
        {/* 정본 패딩: 모바일 20/2/16 → 데스크톱 24/4/18 */}
        <div className="flex flex-col gap-3.5 px-0.5 pt-5 pb-4 min-[631px]:px-1 min-[631px]:pt-6 min-[631px]:pb-[18px]">
          <div
            className="post-body text-sm leading-prose break-words text-gray-800"
            // 서버가 준 HTML 은 DOMPurify 로 살균한 뒤에만 심는다(utils/postHtml.ts)
            dangerouslySetInnerHTML={{ __html: html }}
          />

          <PostAttachments files={attachments} onDownload={download} onPreview={openPreview} />

          <PostReactions
            likes={post.likes ?? []}
            busy={m.reactPost.isPending}
            // 진행 중 재클릭 가드는 «여기»에 둔다 — 버튼을 disabled 로 끄면 초점이 날아간다.
            onToggle={(emoji) => {
              if (m.reactPost.isPending) return
              m.reactPost.mutate(emoji, {
                onError: () => showToast(t('detail-react-failed'), 'error'),
              })
            }}
            onHistory={() => setHistory({ postId, likes: post.likes ?? [], tab: 'likes' })}
          />
        </div>

        <PostComments
          comments={post.comments ?? []}
          meName={me?.name ?? undefined}
          headingRef={commentHeading}
          actions={{
            // 서버는 `is_allow_comment` «그리고» state==='ACT' 를 함께 본다(docs/api/07:167).
            // 숨김·임시저장·예약 글에서 입력창을 열어 두면 등록이 400 으로 실패한다.
            allowed: post.is_allow_comment !== false && post.state === 'ACT',
            // 공감은 게시글 state 를 보지 않는다 — 숨김·예약 글의 댓글도 공감·취소가 200 이다
            // (docs/api/go/07-post-comment-like.md:356). 레거시도 is_allow_comment 만 봤다.
            reactAllowed: post.is_allow_comment !== false,
            isAdmin: !!post.is_admin,
            busy,
            // ⚠ mutate(발사 후 망각) 대신 mutateAsync — 성공 여부를 입력칸에 돌려줘야
            //   실패했을 때 사용자가 쓴 본문을 지우지 않을 수 있다.
            onAdd: async (comment, parentCommentId) => {
              try {
                await m.addComment.mutateAsync({ comment, parentCommentId })
                return true
              } catch {
                showToast(t('detail-comment-failed'), 'error')
                return false
              }
            },
            onEdit: async (commentId, comment) => {
              try {
                await m.editComment.mutateAsync({ commentId, comment })
                return true
              } catch {
                showToast(t('detail-comment-failed'), 'error')
                return false
              }
            },
            onDelete: setDelComment,
            onReact: (commentId, emoji) => {
              if (m.reactComment.isPending) return
              m.reactComment.mutate(
                { commentId, emoji },
                { onError: () => showToast(t('detail-react-failed'), 'error') },
              )
            },
            onHistory: (c) =>
              setHistory({ postId, commentId: c.id, likes: c.likes ?? [], tab: 'likes' }),
          }}
        />
      </article>

      {preview && (
        <FilePreviewModal
          url={preview.url}
          kind={preview.kind}
          name={preview.file.origin_file_name}
          onClose={() => setPreview(null)}
          downloadDisabled={dl.open}
          onDownload={() => {
            const f = preview.file
            setPreview(null)
            void download([f])
          }}
        />
      )}

      {/* 글 삭제 확인 — 남의 글을 관리자가 지울 때 문구가 다르다(레거시 파리티) */}
      {delOpen && (
        <ConfirmModal
          title={t('detail-delete-confirm')}
          sub={post.is_mine ? t('detail-delete-sub') : t('detail-delete-other-sub')}
          confirmLabel={t('common-delete')}
          busy={m.removePost.isPending}
          onCancel={() => setDelOpen(false)}
          onConfirm={() =>
            m.removePost.mutate(undefined, {
              onSuccess: leave,
              onError: (e) => {
                setDelOpen(false)
                // 서버가 전건 거부(200 affected=0)한 경우와 통신 실패를 구분한다.
                const denied = e instanceof Error && e.message === DELETE_REJECTED
                showToast(t(denied ? 'detail-delete-denied' : 'detail-delete-failed'), 'error')
              },
            })
          }
        />
      )}

      {/* 댓글 삭제 확인 — 자리표시자로 남고 답글은 유지된다는 점을 문구로 알린다 */}
      {delComment && (
        <ConfirmModal
          title={t('detail-comment-del-confirm')}
          sub={t('detail-comment-del-sub')}
          confirmLabel={t('common-delete')}
          busy={m.removeComment.isPending}
          onCancel={() => setDelComment(null)}
          onConfirm={() =>
            m.removeComment.mutate(delComment.id, {
              onSettled: () => setDelComment(null),
              // 삭제 버튼이 자리표시자로 바뀌며 사라진다 → 초점을 「댓글 N」 제목으로 옮긴다.
              onSuccess: () => requestAnimationFrame(() => commentHeading.current?.focus()),
              onError: () => showToast(t('detail-comment-failed'), 'error'),
            })
          }
        />
      )}

      {history && <PostHistoryModal target={history} onClose={() => setHistory(null)} />}

      {dlCancelAsk && (
        <ConfirmModal
          title={t('detail-dl-cancel-ask')}
          sub={<DownloadProgressText dl={dl} />}
          confirmLabel={t('common-cancel')}
          cancelLabel={t('detail-dl-cancel-keep')}
          compact
          busy={false}
          onCancel={() => setDlCancelAsk(false)}
          onConfirm={() => {
            setDlCancelAsk(false)
            dl.cancel()
          }}
        />
      )}

      {/* 다운로드 진행 — 여러 건이면 zip 으로 묶는다(useDriveDownload).
          스크림 클릭(onClose)은 «확인»을 띄운다. 바로 cancel() 하면 오클릭 한 번에
          진행 중 다운로드가 확인 없이 끊긴다. */}
      {dl.open && (
        <Modal onClose={() => setDlCancelAsk(true)} label={t('drive-dl-title')} role="alertdialog">
          {/* 정본 dl* 진행 모달: 340 · r8 · padding 22/20/18 · gap14 · 제목 14/700 · 닫기 28 r8 */}
          <div className="flex w-[340px] max-w-full flex-col gap-3.5 rounded-md bg-card px-5 pt-[22px] pb-[18px] shadow-[var(--shadow-modal)]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">{t('drive-dl-title')}</span>
              <button
                type="button"
                onClick={() => setDlCancelAsk(true)}
                aria-label={t('common-close')}
                className="ml-auto inline-flex size-7 flex-none items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
              >
                <CloseIcon />
              </button>
            </div>
            <DownloadProgress dl={dl} />
            <button
              type="button"
              onClick={() => setDlCancelAsk(true)}
              className="h-[38px] w-full rounded-md border border-gray-200 bg-card text-s font-semibold text-gray-800 hover:bg-gray-100"
            >
              {t('common-cancel')}
            </button>
          </div>
        </Modal>
      )}

      <Toast toast={toast} onClose={hideToast} />
    </div>
  )
}

/**
 * 이전/다음 글. 없으면 «보이지만 비활성» — 정본이 `{{ prevC }}`/`{{ prevCur }}` 로 색과 커서만
 * 바꾼다. 색만으로는 이유가 전달되지 않으므로 `aria-describedby` 로 문구를 붙인다.
 */
function NavBtn({
  to,
  label,
  reason,
  dir,
}: {
  to: string | null | undefined
  label: string
  reason: string
  dir: 'left' | 'right'
}) {
  const id = `nav-${dir}-reason`
  if (!to) {
    return (
      <>
        <span
          className={`${NAV_BTN} text-gray-200`}
          role="button"
          aria-disabled="true"
          aria-label={label}
          aria-describedby={id}
        >
          <ChevronIcon className="size-[15px]" dir={dir} />
        </span>
        <span id={id} className="sr-only">
          {reason}
        </span>
      </>
    )
  }
  return (
    <Link
      to="/post/$postId"
      params={{ postId: to }}
      aria-label={label}
      title={label}
      className={`${NAV_BTN} text-gray-700 hover:bg-gray-100`}
    >
      <ChevronIcon className="size-[15px]" dir={dir} />
    </Link>
  )
}

function ConfirmModal({
  title,
  sub,
  confirmLabel,
  cancelLabel,
  compact,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string
  sub: React.ReactNode
  confirmLabel: string
  /** 「취소」가 아닌 문구가 필요할 때 — 다운로드 취소 확인은 「계속 받기」다. */
  cancelLabel?: string
  /** 정본 dl* 취소 확인은 버튼이 h38 · 13/600 이다(cf* 는 h40 · 14/600). */
  compact?: boolean
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const btn = compact ? 'h-[38px] text-s' : 'h-10 text-sm'
  return (
    <Modal onClose={onCancel} label={title} role="alertdialog">
      {/* 정본 cf* 확인 모달: 320 · r8 · padding 26/22/18 (개선안 통합 앱) */}
      <div className="flex w-80 max-w-full flex-col items-center gap-2 rounded-md bg-card px-[22px] pt-[26px] pb-[18px] shadow-[var(--shadow-modal)]">
        <span className="text-center text-sm font-semibold text-gray-900">{title}</span>
        <span className="text-center text-s text-gray-500">{sub}</span>
        <div className="mt-2.5 flex w-full gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={`inline-flex flex-1 items-center justify-center rounded-md border border-gray-200 bg-card font-semibold text-gray-800 hover:bg-gray-100 ${btn}`}
          >
            {cancelLabel ?? t('common-cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex flex-1 items-center justify-center rounded-md bg-destructive font-semibold text-white hover:bg-destructive-hover disabled:opacity-60 ${btn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** 정본 메타줄의 웃는 얼굴 — 공감 총합 아이콘(개선안 통합 앱.dc.html:510). */
function SmileIcon() {
  return (
    <svg
      className="size-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path
        d="M8.5 10h.01M15.5 10h.01M8.5 14.5s1.2 1.5 3.5 1.5 3.5-1.5 3.5-1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** 진행 막대 + 문구 — 진행률을 구독하는 «유일한» 컴포넌트다(본문·첨부·댓글은 다시 그리지 않는다). */
function DownloadProgress({ dl }: { dl: ReturnType<typeof useDriveDownload> }) {
  const { t } = useTranslation()
  const p = useDownloadProgress(dl)
  return (
    <>
      <div
        role="progressbar"
        aria-valuenow={p.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
      >
        <div className="h-full bg-primary" style={{ width: `${p.percent}%` }} />
      </div>
      <span aria-live="polite" className="text-s text-gray-500">
        {t('drive-dl-progress-n', { done: p.done, total: p.total, percent: p.percent })}
      </span>
    </>
  )
}

/** 취소 확인 문구의 진행률 — 여기서만 구독한다. */
function DownloadProgressText({ dl }: { dl: ReturnType<typeof useDriveDownload> }) {
  const { t } = useTranslation()
  const p = useDownloadProgress(dl)
  return <>{t('drive-dl-progress-n', { done: p.done, total: p.total, percent: p.percent })}</>
}
