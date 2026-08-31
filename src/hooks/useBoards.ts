import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { isAuthenticated } from '@/lib/authStorage'
import { selectBookmarkedBoards, toggleBoardBookmark } from '@/services/boardService'

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
