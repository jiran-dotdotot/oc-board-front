import { useQuery } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { selectDepartments } from '@/services/departmentService'

/**
 * 조직도. 응답이 전사 트리 한 덩어리(로컬 실측 496명·142KB)라 **열렸을 때 한 번만** 받고
 * 세션 동안 캐시한다 — 검색·필터는 클라이언트에서 한다. 조직도는 게시판 쓰기로 바뀌지 않으므로
 * 설정 화면의 다른 무효화(`['categories']` 등)와 키를 섞지 않는다.
 */
export function useDepartments(categoryId: string | null, enabled: boolean) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['departments', categoryId ?? 'all', i18n.language],
    queryFn: () => selectDepartments(categoryId, i18n.language),
    enabled,
    staleTime: Infinity,
  })
}
