// 게시판 API 서비스. GET /api/v1/board (selectBoard) · POST /api/v1/board/bookmark/{board}.
import { apiClient } from '@/lib/apiClient'
import { serializeParams } from '@/lib/queryParams'
import type { CategoryBoard } from '@/types/category'
import type { Paginated } from '@/types/post'

// 사이드바 즐겨찾기는 한 페이지로 끝낸다 — 개인 북마크라 이 이상 쌓이는 화면이 아니다.
const BOOKMARK_TAKE = 100

// 내가 북마크한 게시판.
// ⚠ 카테고리 트리(GET /category)에서 is_bookmark를 걸러 쓰면 안 된다 — 트리 포함 조건은
//   '카테고리' 멤버십/부서/카테고리관리자라(docs/api/03-category.md §1), 게시판 멤버로만
//   읽는 보드는 카테고리가 트리에 없어 통째로 빠진다. 즐겨찾기는 이 엔드포인트가 정본이다.
// ⚠ GET /board 는 읽기 권한 필터도 is_active 필터도 없다(docs/api/04-board.md §3.1).
//   권한은 북마크 시점에 이미 검사됐고(POST /board/bookmark 는 read 필요), is_active는 여기서 거른다.
// 정렬은 서버 고정 — 북마크 updated_at asc(= 즐겨찾기한 순서).
export async function selectBookmarkedBoards(lang: string): Promise<CategoryBoard[]> {
  const { data } = await apiClient.get<Paginated<CategoryBoard>>('/board', {
    params: { is_bookmark: 1, take: BOOKMARK_TAKE },
    paramsSerializer: { serialize: serializeParams },
    headers: { lang },
  })
  return (data.data ?? []).filter((b) => b.is_active !== false)
}

// 북마크 토글(등록↔해제). 해제도 200이라 응답의 deleted_at 유무로 현재 상태를 판정한다.
export async function toggleBoardBookmark(boardId: string): Promise<boolean> {
  const { data } = await apiClient.post<{ deleted_at?: string | null }>(
    `/board/bookmark/${boardId}`,
  )
  return !data?.deleted_at
}
