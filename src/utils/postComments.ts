import type { PostComment, PostLikeStat } from '@/types/post'

/**
 * 대댓글 자식 배열. 문서는 관계명 `childComments` 로 적었지만 Laravel 의 `$snakeAttributes`
 * 기본값 때문에 실제 JSON 키는 `child_comments` 로 내려온다(레거시 PostView.vue:79 가 그걸 읽는다).
 * 어느 쪽이 와도 읽는다 — 키 하나 때문에 대댓글이 통째로 사라지는 게 최악이다.
 */
export function commentChildren(c: PostComment): PostComment[] {
  return c.child_comments ?? c.childComments ?? []
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
