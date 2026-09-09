import type { LikeToggleResult } from '@/services/postService'
import type { PostComment, PostLikeStat } from '@/types/post'
import { commentChildren } from '@/utils/postComments'

/**
 * 상세 캐시를 «직접 패치»하기 위한 순수 함수들.
 *
 * 왜 재조회가 아니라 패치인가: `GET /post/{post}` 는 호출마다 `view_logs` 를 1건 넣는다
 * (docs/api/go/05-post-read.md:42). invalidate 로 재조회하면 공감 한 번에 조회수가 오른다
 * (실측: 28 → 29). 그래서 mutation 응답으로 캐시를 고친다.
 */

/**
 * 이모지 집계 한 벌에 토글 결과를 반영한다.
 * 켜짐/꺼짐은 응답의 `deleted_at` 으로만 판정한다 — 취소도 200 이다(07:277).
 */
export function applyToggle<T extends PostLikeStat>(
  likes: T[] | undefined,
  res: LikeToggleResult,
  make: (emoji: string) => T,
): T[] {
  const list = likes ?? []
  const hit = list.find((l) => l.emoji === res.emoji)
  if (res.deleted_at) {
    if (!hit) return list
    return (
      list
        .map((l) => (l.emoji === res.emoji ? { ...l, count: l.count - 1, is_reacted: 0 } : l))
        // 0 건이 된 이모지는 칩에서 빼야 한다 — 서버 집계도 «1건 이상»만 준다(07:288).
        .filter((l) => l.count > 0)
    )
  }
  if (!hit) return [...list, make(res.emoji)]
  return list.map((l) => (l.emoji === res.emoji ? { ...l, count: l.count + 1, is_reacted: 1 } : l))
}

/**
 * 댓글 트리(2단)에서 id 가 맞는 한 칸만 바꾼다.
 * 자식 키는 `child_comments` 하나다(docs/api/go/05-post-read.md:237).
 */
export function mapCommentTree(
  comments: PostComment[],
  id: string,
  fn: (c: PostComment) => PostComment,
): PostComment[] {
  return comments.map((c) => {
    if (c.id === id) {
      // 정규화는 «fn 의 결과» 를 기준으로 한다 — 원본 자식으로 덮으면 fn 이 방금 붙인
      // 답글이 버려진다(테스트가 이걸 잡았다).
      const next = fn(c)
      return { ...next, child_comments: commentChildren(next) }
    }
    const kids = commentChildren(c)
    if (kids.length === 0) return c
    if (!kids.some((k) => k.id === id)) return c
    return {
      ...c,
      child_comments: kids.map((k) => (k.id === id ? fn(k) : k)),
    }
  })
}

/** 최상위 또는 지정한 부모의 꼬리에 새 댓글을 붙인다(서버 정렬이 오름차순이다). */
export function appendComment(
  comments: PostComment[],
  created: PostComment,
  parentCommentId?: string,
): PostComment[] {
  if (!parentCommentId) return [...comments, created]
  return mapCommentTree(comments, parentCommentId, (c) => ({
    ...c,
    child_comments: [...commentChildren(c), created],
  }))
}
