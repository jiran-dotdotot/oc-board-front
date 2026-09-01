import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { isAuthenticated } from '@/lib/authStorage'
import { selectBoard, selectBookmarkedBoards, toggleBoardBookmark } from '@/services/boardService'

// 사이드바 즐겨찾기. 셸 전역에서 쓰이므로 useCategories와 같은 staleTime을 둔다.
export function useBookmarkedBoards() {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['boards', 'bookmarked', i18n.language],
    queryFn: () => selectBookmarkedBoards(i18n.language),
    enabled: isAuthenticated(),
    staleTime: 5 * 60 * 1000,
  })
}

// 게시판 상세(헤더의 게시판명·글쓰기 권한). 목록 화면 진입마다 재호출하지 않도록 staleTime을 둔다.
export function useBoard(boardId: string | undefined) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['board', boardId, i18n.language],
    queryFn: () => selectBoard(boardId!, i18n.language),
    enabled: !!boardId && isAuthenticated(),
    staleTime: 5 * 60 * 1000,
    // 삭제된 게시판(404)·권한 없음(403)은 재시도해도 결과가 같다.
    retry: (count, err) => {
      const status = (err as { response?: { status?: number } })?.response?.status
      return status !== 404 && status !== 403 && count < 1
    },
  })
}

// 북마크 토글. 카테고리 트리에도 is_bookmark가 실려 오므로 둘 다 무효화한다.
export function useBoardBookmarkMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (boardId: string) => toggleBoardBookmark(boardId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boards', 'bookmarked'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}
