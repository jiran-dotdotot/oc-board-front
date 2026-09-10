import { createFileRoute } from '@tanstack/react-router'

import { WriteScreen } from '@/components/board/WriteScreen'

export interface WriteSearch {
  /** 새 글 — 게시판 프리셋(레거시 `?boardId=`, AddPostView.vue:483-491). */
  boardId?: string
  /** 수정 모드 — 임시저장 첫 저장 뒤에도 이 값으로 갈아탄다(이후 저장은 PUT). */
  postId?: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const uuid = (v: unknown) => (typeof v === 'string' && UUID.test(v) ? v : undefined)

export const Route = createFileRoute('/write')({
  // 형식이 아닌 값은 버린다 — Go 는 UUID 형식 오류를 400 INVALID_PAYLOAD 로 준다(06:204·:264).
  validateSearch: (search: Record<string, unknown>): WriteSearch => ({
    boardId: uuid(search.boardId),
    postId: uuid(search.postId),
  }),
  component: WriteScreen,
})
