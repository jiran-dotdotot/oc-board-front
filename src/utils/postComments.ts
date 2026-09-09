import type { PostComment, PostLikeStat } from '@/types/post'

/**
 * 대댓글 자식 배열. Go 계약의 키는 `child_comments` 하나뿐이다
 * (docs/api/go/05-post-read.md:237 — 답글이 없으면 `[]`).
 * 별칭 폴백을 두지 않는다 — 계약에 없는 키를 받아 주면 다음 회귀를 조용히 숨긴다(BR-032 규약).
 */
export function commentChildren(c: PostComment): PostComment[] {
  return c.child_comments ?? []
}

/**
 * 메타줄의 공감 총합. 정본 `{{ dReactTotal }}` 자리 값이다(댓글 수가 아니다).
 * 서버 `like_count` 는 비동기 큐라 방금 누른 반응이 안 반영되므로, 칩 집계를 직접 더한다.
 */
export function reactionTotal(likes: PostLikeStat[] | undefined): number {
  return (likes ?? []).reduce((sum, l) => sum + l.count, 0)
}

/**
 * 화면에 실제로 보이는 댓글 수. `comment_count` 는 «비활성 댓글까지» 센다(07:235 — 삭제해도
 * 줄지 않는다). 자리표시자도 한 칸을 차지하므로 활성/비활성 구분 없이 트리 전체를 센다.
 */
export function countComments(comments: PostComment[] | undefined): number {
  return (comments ?? []).reduce((n, c) => n + 1 + commentChildren(c).length, 0)
}
