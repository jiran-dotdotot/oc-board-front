import { useEffect, useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { HISTORY_PAGE_SIZE } from './constants'
import { Modal } from '@/components/common/Modal'
import { Pagination } from '@/components/common/Pagination'
import { CloseIcon } from '@/components/common/icons'
import { isAuthenticated } from '@/lib/authStorage'
import { getCommentLikeUsers, getPostLikeUsers, getPostViewers } from '@/services/postService'
import type { PostLikeStat } from '@/types/post'
import { initial, pastel } from '@/utils/avatar'
import { fmtDateTime } from '@/utils/date'

export type HistoryTab = 'views' | 'likes'

/** 댓글 내역이면 조회 탭이 없다 — 댓글엔 조회 로그가 없다. */
export interface HistoryTarget {
  postId: string
  commentId?: string
  likes: PostLikeStat[]
  tab: HistoryTab
}

function Avatar({ name, size }: { name: string | undefined; size: string }) {
  return (
    <span
      className={`inline-flex ${size} flex-none items-center justify-center rounded-full text-xs font-bold text-on-pastel ${pastel(name ?? '?')}`}
    >
      {initial(name)}
    </span>
  )
}

/**
 * 조회 · 공감 내역. 정본 아트보드엔 이 모달이 없지만(`dReactHistory` 가 호출처만 있는 죽은
 * 버튼) 설명문서 docs/02_read.md 와 레거시 UserListModal.vue 에는 있어 살렸다.
 *
 * ⚠ 공감 목록 API 는 `emoji` 가 **필수**다(미전송 400 — docs/api/07:325). 그래서 이모지 칩은
 *   장식이 아니라 «필수 파라미터 선택기»다. 반응이 0건이면 부를 수 없으므로 빈 상태를 그린다.
 * ⚠ 레거시는 댓글 공감 목록 페이징에 POST 를 써서 페이지를 넘길 때마다 반응이 토글됐다
 *   (jupiter-board-web/src/stores/comment.ts:33). 여기서는 GET 이다.
 */
export function PostHistoryModal({
  target,
  onClose,
}: {
  target: HistoryTarget
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<HistoryTab>(target.commentId ? 'likes' : target.tab)
  const [emoji, setEmoji] = useState(target.likes[0]?.emoji ?? '')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // 탭·이모지를 바꾸면 1페이지로 — 5페이지에서 이모지를 바꾸면 없는 페이지를 부른다.
  const pick = (next: HistoryTab) => {
    setTab(next)
    setPage(1)
  }
  const pickEmoji = (e: string) => {
    setEmoji(e)
    setPage(1)
  }

  const views = useQuery({
    // 세 내역 API 는 lang 을 «보내지 않는다»(services/postService.ts) → 언어를 키에 넣으면
    // 바이트가 같은 응답을 전량 재요청하고 라이브 리전이 「불러오는 중」을 다시 읽는다.
    queryKey: ['post-viewers', target.postId, page],
    queryFn: () => getPostViewers(target.postId, page, HISTORY_PAGE_SIZE),
    enabled: tab === 'views' && !target.commentId && isAuthenticated(),
  })

  const likes = useQuery({
    queryKey: ['post-likers', target.postId, target.commentId, emoji, page],
    queryFn: () =>
      target.commentId
        ? getCommentLikeUsers(target.commentId, emoji, page, HISTORY_PAGE_SIZE)
        : getPostLikeUsers(target.postId, emoji, page, HISTORY_PAGE_SIZE),
    // emoji 가 빈 문자열이면 400 이다 — 반응이 0건이면 아예 부르지 않는다.
    enabled: tab === 'likes' && !!emoji && isAuthenticated(),
  })

  const active = tab === 'views' ? views : likes
  // ⚠ isPending 이 아니라 isLoading 이다. react-query v5 의 «disabled» 쿼리는 데이터가 없으니
  //   status='pending' 으로 남는다 — 공감 0건이면 emoji 가 빈 문자열이라 쿼리를 끄는데,
  //   isPending 으로 판정하면 「불러오는 중…」이 영구 표시되고 빈 상태에 도달하지 못한다.
  //   isLoading = isPending && isFetching 이라 «끈» 쿼리에서는 false 다.
  const loading = active.isLoading
  const totalPages = active.data?.last_page ?? 1

  return (
    <Modal onClose={onClose} labelledBy="history-title">
      <div className="flex max-h-[80vh] w-[min(460px,92vw)] flex-col overflow-hidden rounded-lg bg-card shadow-[var(--shadow-modal)]">
        <div className="flex h-[52px] flex-none items-center gap-2.5 border-b border-gray-100 px-[18px]">
          <span id="history-title" className="text-sm font-bold">
            {t(tab === 'views' ? 'detail-history-views' : 'detail-like-history')}
          </span>
          <button
            type="button"
            aria-label={t('common-close')}
            onClick={onClose}
            className="ml-auto inline-flex size-[30px] flex-none items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
          >
            <CloseIcon />
          </button>
        </div>

        {!target.commentId && (
          <div role="tablist" className="flex flex-none gap-1 border-b border-gray-100 px-[18px]">
            {(['views', 'likes'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => pick(k)}
                className={`h-10 border-b-2 px-2.5 text-s font-semibold ${
                  tab === k
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {t(k === 'views' ? 'detail-history-views' : 'detail-like-history')}
              </button>
            ))}
          </div>
        )}

        {tab === 'likes' && target.likes.length > 0 && (
          <div className="flex flex-none flex-wrap gap-1.5 border-b border-gray-100 px-[18px] py-2.5">
            {target.likes.map((l) => (
              <button
                key={l.emoji}
                type="button"
                aria-pressed={emoji === l.emoji}
                onClick={() => pickEmoji(l.emoji)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-s font-semibold ${
                  emoji === l.emoji
                    ? 'border-primary bg-ov-blue-50 text-primary'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="text-sm leading-none">{l.emoji}</span>
                {l.count}
              </button>
            ))}
          </div>
        )}

        {/* 로딩·오류·빈 상태·목록 교체가 여기서 일어난다 → 라이브 리전으로 감싸야
            스크린리더가 「불러오는 중」·「없습니다」·행 수 변화를 읽어 준다(WCAG 4.1.3).
            aria-busy 로 «지금 갱신 중»임을 함께 알린다. */}
        <div
          role="status"
          aria-live="polite"
          aria-busy={loading}
          className="min-h-[140px] flex-1 overflow-y-auto p-2"
        >
          {loading && <p className="p-4 text-center text-s text-gray-500">{t('common-loading')}</p>}
          {active.isError && (
            <p className="p-4 text-center text-s text-destructive">{t('detail-history-failed')}</p>
          )}
          {tab === 'views' &&
            views.data?.data.map((v) => (
              <div
                key={v.user_id}
                className="flex min-h-12 items-center gap-2.5 rounded-md px-2.5 py-1.5 hover:bg-gray-100"
              >
                <Avatar name={v.user?.name ?? undefined} size="size-[30px]" />
                <span className="min-w-0 flex-1 truncate text-s font-semibold">
                  {v.user?.name ?? '-'}
                </span>
                <span className="flex-none text-xs text-gray-400">
                  {t('detail-view-times', { n: v.count })}
                </span>
                <span className="flex-none text-xs text-gray-400">
                  {fmtDateTime(v.last_visit_at)}
                </span>
              </div>
            ))}
          {tab === 'likes' &&
            likes.data?.data.map((u) => (
              <div
                key={`${u.user_id}-${u.created_at}`}
                className="flex min-h-12 items-center gap-2.5 rounded-md px-2.5 py-1.5 hover:bg-gray-100"
              >
                <Avatar name={u.user?.name ?? undefined} size="size-[30px]" />
                <span className="min-w-0 flex-1 truncate text-s font-semibold">
                  {u.user?.name ?? '-'}
                </span>
                <span className="flex-none text-sm">{emoji}</span>
                <span className="flex-none text-xs text-gray-400">{fmtDateTime(u.created_at)}</span>
              </div>
            ))}
          {tab === 'views' && views.data?.data.length === 0 && (
            <p className="p-4 text-center text-s text-gray-500">{t('detail-no-viewers')}</p>
          )}
          {tab === 'likes' && (!emoji || likes.data?.data.length === 0) && !likes.isLoading && (
            <p className="p-4 text-center text-s text-gray-500">{t('detail-no-likers')}</p>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex flex-none justify-center border-t border-gray-100 py-2.5">
            <Pagination page={page} totalPages={totalPages} onPick={setPage} />
          </div>
        )}
      </div>
    </Modal>
  )
}
