import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { isAuthenticated } from '@/lib/authStorage'
import { selectPost } from '@/services/postService'
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
