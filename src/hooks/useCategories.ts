import { useQuery } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { isAuthenticated } from '@/lib/authStorage'
import { selectCategory } from '@/services/categoryService'

// 사이드바 게시판 트리. 셸 전역에서 쓰이므로 staleTime을 길게 둬 화면 이동마다 재호출하지 않는다.
export function useCategories() {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['categories', i18n.language],
    queryFn: () => selectCategory(i18n.language),
    enabled: isAuthenticated(), // 토큰 없으면 호출 안 함(401 리다이렉트 루프 방지)
    staleTime: 5 * 60 * 1000,
  })
}
