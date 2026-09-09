import { useEffect, useId, useRef, useState } from 'react'

import { useTranslation } from 'react-i18next'

import { ReactionPicker } from './ReactionPicker'
import { COMMENT_HEART_EMOJI } from './constants'
import { Avatar } from '@/components/common/Avatar'
import { Popover } from '@/components/common/Popover'
import { DotsIcon, HeartIcon, ReplyArrowIcon } from '@/components/common/icons'
import type { PostComment } from '@/types/post'
import { fmtDateTime } from '@/utils/date'
import { commentChildren, countComments } from '@/utils/postComments'

/** 내용에 맞춰 높이를 늘린다. 한 줄이면 40px, 최대 105px(레거시와 같은 상한) 뒤엔 스크롤. */
function grow(el: HTMLTextAreaElement) {
  el.style.height = ''
  el.style.height = `${el.scrollHeight}px`
}

export interface CommentActions {
  /** 성공하면 true. 실패면 false — 호출부가 «입력값을 지우지 않고» 그대로 둔다. */
  onAdd: (comment: string, parentCommentId?: string) => Promise<boolean>
  onEdit: (commentId: string, comment: string) => Promise<boolean>
  onDelete: (c: PostComment) => void
  onReact: (commentId: string, emoji: string) => void
  onHistory: (c: PostComment) => void
  /** 게시글이 댓글을 받지 않으면 입력·답글·수정이 전부 400/403 이다 — 미리 막는다. */
  /** 댓글 작성·수정 가능 여부 — 서버는 is_allow_comment «그리고» state==='ACT' 를 본다. */
  allowed: boolean
  /** 공감 가능 여부. 서버는 공감에서 게시글 state 를 «검사하지 않는다»
   *  (docs/api/go/07-post-comment-like.md:356) — 숨김 글의 댓글도 공감·취소가 200 이다. */
  reactAllowed: boolean
  /** 게시판 관리자면 남의 댓글도 지울 수 있다(docs/api/07:213). */
  isAdmin: boolean
  busy: boolean
}

/**
 * 댓글 행의 ⋮ 메뉴. 정본(통합 앱)엔 「삭제」 텍스트 하나뿐인데 우리는 수정·공감 내역까지
 * 넣기로 했다(사용자 결정) → 행에 버튼이 최대 6개까지 늘어 디자인과 크게 어긋났다.
 * 셋을 여기로 접고 하트·답글만 행에 남긴다.
 *
 * 팝오버는 모달이 아니다 — ESC · 바깥 클릭 · 초점 이탈로 닫고 초점을 트리거로 돌려준다
 * (ReactionPicker 와 같은 규약. ESC 를 가로채지 않는다).
 */
function CommentMenu({
  label,
  items,
  btnRef,
}: {
  label: string
  items: { key: string; label: string; danger?: boolean; onPick: () => void }[]
  /** 편집창을 닫을 때 초점을 돌려받을 수 있도록 호출부가 트리거를 잡아 둔다. */
  btnRef?: React.RefObject<HTMLButtonElement | null>
}) {
  if (items.length === 0) return null
  return (
    <Popover
      label={label}
      btnRef={btnRef}
      triggerClass="inline-flex size-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      trigger={<DotsIcon />}
      panelClass="top-[calc(100%+4px)] right-0 w-[150px] p-1"
    >
      {(close) =>
        items.map((it) => (
          <button
            key={it.key}
            type="button"
            onClick={() => {
              // ⚠ 순서가 중요하다 — close() 가 «지금 초점을 쥔 이 버튼»을 언마운트하므로
              //   먼저 트리거로 초점을 돌려놓아야 뒤이어 열리는 모달의 opener 가 body 가 되지 않는다.
              close()
              it.onPick()
            }}
            className={`flex h-[34px] w-full items-center rounded-md px-2.5 text-s ${
              it.danger
                ? 'text-destructive hover:bg-destructive-bg'
                : 'text-gray-800 hover:bg-gray-100'
            }`}
          >
            {it.label}
          </button>
        ))
      }
    </Popover>
  )
}

/** 한 줄 «모양»의 입력 + 등록. 정본 :573-576 은 한 줄이지만 요소는 textarea 다(위 주석 참고). */
function CommentInput({
  placeholder,
  initialValue,
  submitLabel,
  onSubmit,
  onCancel,
  authorName,
  busy,
}: {
  placeholder: string
  initialValue?: string
  submitLabel: string
  /** 성공하면 true. false 면 입력값을 유지한다 — 사용자가 쓴 글을 잃게 하지 않는다. */
  onSubmit: (v: string) => Promise<boolean>
  onCancel?: () => void
  authorName?: string
  busy: boolean
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState(initialValue ?? '')
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const hintId = useId()
  // 중복 전송 가드를 «로컬 ref» 로도 둔다 — busy 는 부모 prop 이라 같은 틱에 연달아 들어온
  // 입력에는 아직 false 다. 버튼을 disabled 로 끄지 않는 이유는 아래 주석 참고.
  const sending = useRef(false)
  // 빈 입력 가드는 «세 경로 모두»에 둔다 — 레거시는 답글 수정 경로에만 빠져 있어
  // 빈 댓글이 제출됐다(ReplyComment.vue:76).
  const empty = value.trim().length === 0

  // 수정 모드는 기존 내용으로 시작하므로 첫 렌더에 높이를 맞춰야 한 줄로 잘려 보이지 않는다.
  useEffect(() => {
    if (inputRef.current) grow(inputRef.current)
  }, [])

  const submit = async () => {
    if (empty || busy || sending.current) return
    sending.current = true
    try {
      // ⚠ 성공을 확인한 «뒤에» 비운다. 먼저 비우면 서버가 400/500 을 줬을 때 사용자가 쓴
      //   본문이 어디에도 남지 않는다(수정 경로는 수정 전 텍스트까지 사라진다).
      if (await onSubmit(value.trim())) {
        setValue('')
        // 비우면 등록 버튼이 disabled 가 되어 초점이 body 로 떨어진다 → 입력칸으로 돌려준다.
        if (inputRef.current) {
          inputRef.current.style.height = ''
          inputRef.current.focus()
        }
      }
    } finally {
      sending.current = false
    }
  }

  return (
    <div className="flex gap-2.5 pt-1">
      <Avatar name={authorName} size="size-8" />
      <div className="flex min-w-0 flex-1 gap-2">
        {/* 정본은 «한 줄» 입력이지만(정본 :573) input 은 줄바꿈을 담을 수 없어
            레거시에 있던 여러 줄 작성이 사라진다 → 모양은 한 줄, 요소는 textarea 로 둔다.
            Enter=등록 / Shift+Enter=줄바꿈 (레거시 모바일 입력과 같은 규약). */}
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            grow(e.currentTarget)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void submit()
            }
            // ⚠ Escape 에도 조합 가드가 필요하다. 한글·일본어 IME 에서 마지막 음절 «조합만»
            //   취소하려고 누른 ESC 가 isComposing=true 로 먼저 도착하는데, 그대로 onCancel()
            //   하면 편집·답글 폼이 언마운트되며 작성 중인 본문이 통째로 사라진다(되돌리기 없음).
            //   ASCII 입력엔 조합 단계가 없어 재현되지 않는다 — 한국어 사용자에게만 터진다.
            if (e.key === 'Escape' && !e.nativeEvent.isComposing && onCancel) onCancel()
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-describedby={hintId}
          className={`max-h-[105px] min-h-10 min-w-0 flex-1 resize-none overflow-y-auto rounded-md border bg-card px-3.5 py-[9px] text-sm leading-[22px] outline-none focus:border-primary ${
            value ? 'border-primary' : 'border-gray-300'
          }`}
        />
        <span id={hintId} className="sr-only">
          {t('detail-comment-multiline-hint')}
        </span>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 flex-none items-center rounded-md border border-gray-200 bg-card px-3 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            {t('common-cancel')}
          </button>
        )}
        <button
          type="button"
          onClick={() => void submit()}
          // busy 로 끄지 않는다 — 초점을 쥔 버튼을 disabled 로 만들면 브라우저가 초점을
          // body 로 되돌린다. 중복 전송은 submit() 안의 sending 가드가 막는다.
          disabled={empty}
          className="inline-flex h-10 flex-none items-center rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-ov-blue-700 disabled:bg-gray-100 disabled:text-gray-300"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  )
}

function CommentRow({
  c,
  a,
  reply,
  meName,
}: {
  c: PostComment
  a: CommentActions
  reply?: boolean
  meName?: string
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [replying, setReplying] = useState(false)
  // 편집창·답글창이 닫히면 그 안의 초점 요소가 사라진다 → 열었던 버튼으로 돌려준다(WCAG 2.4.3).
  // 「수정」은 ⋮ 메뉴 «안»에 있어 항목 버튼이 사라진다 → 메뉴 트리거를 초점 반환 지점으로 쓴다.
  const menuBtn = useRef<HTMLButtonElement | null>(null)
  const replyBtn = useRef<HTMLButtonElement | null>(null)
  const restore = (r: React.RefObject<HTMLButtonElement | null>) =>
    requestAnimationFrame(() => r.current?.focus())

  // 삭제된 댓글은 «숨기지 않고» 자리표시자로 남긴다 — 대화 흐름이 끊기지 않게(레거시 파리티).
  // ⚠ 자식 대댓글은 «연쇄 삭제되지 않는다»(docs/api/07:236) — 여기서 early return 하면
  //   부모를 지운 순간 살아 있는 답글까지 화면에서 사라진다. 레거시도 자식을 유지한다
  //   (Comment.vue:333 의 v-for 가 v-if 밖에 있다).
  if (!c.is_active) {
    return (
      <div className={reply ? 'mt-1.5 flex gap-2' : 'flex gap-2.5'}>
        {reply && <ReplyArrowIcon className="mt-[5px] size-3.5 flex-none text-gray-300" />}
        <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
          <p className="text-sm text-gray-500">{t('detail-comment-deleted')}</p>
          {commentChildren(c).map((r) => (
            <CommentRow key={r.id} c={r} a={a} reply meName={meName} />
          ))}
        </div>
      </div>
    )
  }

  const hearts = (c.likes ?? []).find((l) => l.emoji === COMMENT_HEART_EMOJI)
  const others = (c.likes ?? []).filter((l) => l.emoji !== COMMENT_HEART_EMOJI)
  const canDelete = !!c.is_mine || a.isAdmin

  return (
    <>
      {/* 정본 댓글 행에는 «테두리도 세로 패딩도 없다» — 행 간격은 부모의 gap:16 하나로 만든다.
          예전엔 행마다 border-t + py-14 를 그려 디자인과 다르게 줄이 그어져 보였다. */}
      <div className={reply ? 'mt-1.5 flex gap-2' : 'flex gap-2.5'}>
        {reply && <ReplyArrowIcon className="mt-[5px] size-3.5 flex-none text-gray-300" />}
        <Avatar name={c.user?.name ?? undefined} size={reply ? 'size-[26px]' : 'size-8'} />
        <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
          <div className="flex items-center gap-2">
            <span className="text-s font-semibold">{c.user?.name ?? '-'}</span>
            <span className="text-xs text-gray-400">{fmtDateTime(c.created_at)}</span>
            <span className="ml-auto flex flex-none items-center">
              <CommentMenu
                btnRef={menuBtn}
                label={t('detail-comment-menu', { name: c.user?.name ?? '' })}
                items={[
                  ...(c.is_mine && a.allowed && !editing
                    ? [{ key: 'edit', label: t('common-edit'), onPick: () => setEditing(true) }]
                    : []),
                  ...((c.likes ?? []).length > 0
                    ? [
                        {
                          key: 'history',
                          label: t('detail-like-history'),
                          onPick: () => a.onHistory(c),
                        },
                      ]
                    : []),
                  ...(canDelete
                    ? [
                        {
                          key: 'delete',
                          label: t('common-delete'),
                          danger: true,
                          onPick: () => a.onDelete(c),
                        },
                      ]
                    : []),
                ]}
              />
            </span>
          </div>

          {editing ? (
            <CommentInput
              placeholder={t('detail-comment-editing')}
              initialValue={c.comment ?? ''}
              submitLabel={t('common-save')}
              authorName={c.user?.name ?? undefined}
              busy={a.busy}
              onCancel={() => {
                setEditing(false)
                restore(menuBtn)
              }}
              onSubmit={async (v) => {
                const ok = await a.onEdit(c.id, v)
                if (ok) {
                  setEditing(false)
                  restore(menuBtn)
                }
                return ok
              }}
            />
          ) : (
            // 여러 줄로 쓴 댓글의 줄바꿈을 살린다 — 없으면 기존 데이터가 한 덩어리로 붙는다.
            <p className="text-sm leading-body break-words whitespace-pre-line text-gray-800">
              {c.comment}
            </p>
          )}

          <div className="mt-0.5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => a.onReact(c.id, COMMENT_HEART_EMOJI)}
              disabled={!a.reactAllowed}
              aria-pressed={!!hearts?.is_reacted}
              aria-label={t(hearts?.is_reacted ? 'detail-react-on' : 'detail-react-off', {
                emoji: COMMENT_HEART_EMOJI,
              })}
              className={`inline-flex h-[22px] items-center gap-1 rounded-full border px-2 text-xs disabled:opacity-60 ${
                hearts?.is_reacted
                  ? 'border-primary bg-ov-blue-50 text-primary hover:bg-ov-blue-100'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-100'
              }`}
            >
              <HeartIcon small filled={!!hearts?.is_reacted} />
              {hearts?.count ?? 0}
            </button>
            {/* 세트 밖 이모지로 달린 기존 반응 — 숨기면 데이터가 사라져 보인다 */}
            {others.map((l) => (
              <button
                key={l.emoji}
                type="button"
                onClick={() => a.onReact(c.id, l.emoji)}
                disabled={!a.reactAllowed}
                aria-pressed={!!l.is_reacted}
                aria-label={t(l.is_reacted ? 'detail-react-on' : 'detail-react-off', {
                  emoji: l.emoji,
                })}
                className={`inline-flex h-[22px] items-center gap-1 rounded-full border px-2 text-xs disabled:opacity-60 ${
                  l.is_reacted
                    ? 'border-primary bg-ov-blue-50 text-primary hover:bg-ov-blue-100'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <span className="text-sm leading-none">{l.emoji}</span>
                {l.count}
              </button>
            ))}
            {/* 대댓글은 «1단»까지다 — 서버는 더 깊게 받지만 상세 응답 트리가 2단만 채운다(07:135) */}
            {!reply && a.allowed && (
              <button
                ref={replyBtn}
                type="button"
                onClick={() => setReplying((v) => !v)}
                aria-expanded={replying}
                className="text-xs text-gray-400 hover:text-primary"
              >
                {t('detail-reply')}
              </button>
            )}
            {/* 정본 댓글 행엔 하트 하나뿐이지만 서버·레거시는 자유 이모지를 허용한다 —
                게시글 공감과 «같은» 고정 세트 팝오버를 붙여 새 이모지도 달 수 있게 한다.
                공감 불가 글에서는 아예 렌더하지 않는다(disabled 만 두면 이유가 안 보인다). */}
            {a.reactAllowed && (
              <ReactionPicker likes={c.likes ?? []} onPick={(e) => a.onReact(c.id, e)} size="sm" />
            )}
          </div>

          {replying && (
            <CommentInput
              placeholder={t('detail-reply-to', { name: c.user?.name ?? '' })}
              submitLabel={t('detail-register')}
              authorName={meName}
              busy={a.busy}
              onCancel={() => {
                setReplying(false)
                restore(replyBtn)
              }}
              onSubmit={async (v) => {
                const ok = await a.onAdd(v, c.id)
                if (ok) {
                  setReplying(false)
                  restore(replyBtn)
                }
                return ok
              }}
            />
          )}
          {/* 답글은 부모 본문 컬럼 «안»에 둔다 — 밖에 두면 목록의 gap-4 가 그대로 적용돼
              「부모와 그 답글」 간격이 「무관한 다음 댓글」 간격과 같아져 위계가 사라진다. */}
          {commentChildren(c).map((r) => (
            <CommentRow key={r.id} c={r} a={a} reply meName={meName} />
          ))}
        </div>
      </div>
    </>
  )
}

/** 댓글 섹션. 정본 :566-578. 목록 API 가 없어 상세 응답의 `comments` 트리를 그대로 그린다. */
export function PostComments({
  comments,
  actions,
  meName,
  headingRef,
}: {
  comments: PostComment[]
  actions: CommentActions
  meName?: string
  /** 댓글을 삭제하면 삭제 버튼째로 사라진다 — 호출부가 여기로 초점을 되돌린다. */
  headingRef?: React.Ref<HTMLSpanElement>
}) {
  const { t } = useTranslation()
  // 정본 패딩: 모바일 16/2/4 → 데스크톱 18/4/4
  return (
    <div className="mt-0.5 flex flex-col gap-4 border-t border-gray-200 px-0.5 pt-4 pb-1 min-[631px]:px-1 min-[631px]:pt-[18px]">
      <span ref={headingRef} tabIndex={-1} className="text-sm font-bold outline-none">
        {t('detail-comments')} <span className="text-primary">{countComments(comments)}</span>
      </span>

      {comments.length === 0 && <p className="text-s text-gray-500">{t('detail-comment-empty')}</p>}
      {comments.map((c) => (
        <CommentRow key={c.id} c={c} a={actions} meName={meName} />
      ))}

      {actions.allowed ? (
        <CommentInput
          placeholder={t('detail-comment-ph')}
          submitLabel={t('detail-register')}
          authorName={meName}
          busy={actions.busy}
          onSubmit={(v) => actions.onAdd(v)}
        />
      ) : (
        <p className="text-s text-gray-500">{t('detail-comment-off')}</p>
      )}
    </div>
  )
}
