import type { PostState } from '@/types/post'

/**
 * 「이 글을 볼 수 없다」는 판정. 세 경로가 같은 결말로 수렴한다:
 *  - 404: 라우트 모델 바인딩 실패(없거나 hard delete) — docs/api/go/05-post-read.md:28
 *  - 200 + `state='DEL'`: 휴지통으로 옮겨진 글. soft delete 가 아니라 상태 전환이라
 *    라우트 바인딩은 통과하고 200 이 온다(docs/api/go/06-post-write.md §삭제·복원) → 응답을 보고 걸러야 한다.
 *  - 403: 게시판 read 권한 없음 — 05:204
 * 그 외 오류는 «다시 시도»가 의미 있으므로 여기서 null 을 돌려준다.
 */
export type BlockedKind = 'not-found' | 'forbidden' | null

export function blockedKind(status: number | undefined, state: PostState | string | undefined) {
  if (status === 404 || state === 'DEL') return 'not-found' as const
  if (status === 403) return 'forbidden' as const
  return null
}

/**
 * 「목록」이 돌아갈 페이지. 상세 응답의 `row_num`(게시판 내 순번)을 «현재 개수 설정»으로 나눈다.
 * ⚠ 레거시는 10 을 하드코딩해(PostView.vue:286) 개수를 20 으로 쓰는 사용자를 엉뚱한 페이지로
 *   보냈다. 개수는 «호출부»가 읽어 넘긴다(utils/listLimit — localStorage 'postLimit',
 *   목록 화면과 공유). 여기는 I/O 없는 순수 계산이라 테스트가 환경에 의존하지 않는다.
 * 1페이지는 URL 에서 생략하는 규약이라 undefined 를 돌려준다(routes/board.$boardId.tsx).
 */
export function listPage(rowNum: number | null | undefined, limit: number): number | undefined {
  // 공지글은 row_num 이 1 이고, state != ACT 이면 null 이다(docs/api/go/05-post-read.md:212)
  if (!rowNum || rowNum < 1 || limit < 1) return undefined
  const page = Math.floor((rowNum - 1) / limit) + 1
  return page > 1 ? page : undefined
}
