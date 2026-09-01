import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { isAuthenticated } from '@/lib/authStorage'
import { selectNotices, selectPost, togglePostBookmark } from '@/services/postService'
import type { PostListParams } from '@/types/post'

// 게시글 목록 조회. lang 헤더는 현재 i18n 언어, 페이지 전환 시 이전 데이터 유지.
export function usePosts(params: PostListParams) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['posts', params, i18n.language],
    queryFn: () => selectPost(params, i18n.language),
    placeholderData: keepPreviousData,
    enabled: isAuthenticated(), // 토큰 없으면 호출 안 함(401 리다이렉트 루프 방지)
  })
}

// 게시판 공지 목록(상단 고정용). is_not_paging → 배열 반환. 안읽음 필터면 is_view 전달.
export function useNotices(params: { board_id?: string; is_view?: boolean }) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['notices', params, i18n.language],
    queryFn: () => selectNotices(params, i18n.language),
    placeholderData: keepPreviousData,
    enabled: isAuthenticated(),
  })
}

// 게시글 북마크 토글. 현재 상태는 목록의 is_bookmark 가 정본이라 목록·공지 둘 다 무효화한다.
export function usePostBookmarkMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (postId: string) => togglePostBookmark(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] })
      qc.invalidateQueries({ queryKey: ['notices'] })
    },
  })
}
