// 게시판 API — 전부 Go 스코프 경로(docs/api/go/04-board.md).
import {
  deleteBoardResource,
  getBoardResource,
  postBoardResource,
  putBoardResource,
} from '@/lib/boardApi'
import { serializeParams } from '@/lib/queryParams'
import type { BoardCreatePayload, BoardUpdatePayload } from '@/types/board'
import type { BoardDetail, CategoryBoard } from '@/types/category'
import type { Paginated } from '@/types/post'

// 사이드바 즐겨찾기는 한 페이지로 끝낸다 — 개인 북마크라 이 이상 쌓이는 화면이 아니다.
const BOOKMARK_TAKE = 100

// Go /bookmarks는 활성·읽기 권한 필터 후 페이지를 반환한다.
// 카테고리 트리에서 추출하지 않는다. 정렬은 bookmark.updated_at, board_id 순.
// 근거: docs/api/go/04-board.md:324-342. board_id는 id와 같은 별칭이다.
export async function selectBookmarkedBoards(lang: string): Promise<CategoryBoard[]> {
  const { data } = await getBoardResource<Paginated<CategoryBoard>>('/bookmarks', {
    params: { take: BOOKMARK_TAKE },
    paramsSerializer: { serialize: serializeParams },
    headers: { lang },
  })
  return data.data
}

// 게시판 상세(docs/api/go/04-board.md:249). 게시판명(title)·글쓰기 권한(is_writable)·
// 관리 권한(is_admin/can_manage)에 더해 **is_bookmark 도 함께 온다**(실측 2026-09-09).
// 컬럼 구성이 CategoryBoard 와 같아 타입을 재사용한다. 읽기 권한 없으면 403.
export async function selectBoard(boardId: string, lang: string): Promise<CategoryBoard> {
  const { data } = await getBoardResource<CategoryBoard>(`/boards/${boardId}`, {
    headers: { lang },
  })
  return data
}

// 북마크 토글(등록↔해제). Go 는 이번 호출 «후» 상태를 is_bookmarked 로 직접 준다
// (docs/api/go/04-board.md:546) — deleted_at 을 추론하지 않는다.
export async function toggleBoardBookmark(boardId: string): Promise<boolean> {
  const { data } = await postBoardResource<{ is_bookmarked: boolean }>(
    `/boards/${boardId}/bookmark`,
  )
  return data.is_bookmarked
}

/** 게시판 상세 + grant 3종 + 자료실 사용량. 트리에는 grant 가 없어 선택 시 따로 받는다. */
export async function selectBoardDetail(boardId: string, lang: string): Promise<BoardDetail> {
  const { data } = await getBoardResource<BoardDetail>(`/boards/${boardId}`, {
    headers: { lang },
  })
  return data
}

/** 게시판 생성 — 200(201 아님). `category_id: null` 은 공용이고 회사 관리자만 가능하다. */
export async function createBoard(payload: BoardCreatePayload): Promise<void> {
  await postBoardResource('/boards', payload)
}

/**
 * 게시판 수정. ⚠️ **추가 키는 400**이므로 `BoardUpdatePayload` 밖의 값을 절대 섞지 않는다
 * (`category_id`·`is_comment_alarm` 도 400). non-DRIVE 로 끝나는 요청에 `size_limit*` 키를
 * 이름만 실어도 422 다 → 호출 쪽에서 자료실일 때만 싣는다.
 */
export async function updateBoard(boardId: string, payload: BoardUpdatePayload): Promise<void> {
  await putBoardResource(`/boards/${boardId}`, payload)
}

/**
 * 게시판 삭제(204). **회사 관리자 또는 카테고리 관리자만** 가능하다 —
 * `can_manage` 로 버튼을 열면 게시판 관리자가 403 을 맞는다(04-board.md:524).
 */
export async function deleteBoard(boardId: string): Promise<void> {
  await deleteBoardResource(`/boards/${boardId}`)
}
