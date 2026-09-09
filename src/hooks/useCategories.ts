import { useQuery } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { useMe } from '@/hooks/useMe'
import { isAuthenticated } from '@/lib/authStorage'
import { selectAdminCategory, selectCategory } from '@/services/categoryService'

// 사이드바 게시판 트리. 셸 전역에서 쓰이므로 staleTime을 길게 둬 화면 이동마다 재호출하지 않는다.
// 회사 관리자(is_admin)는 Go /categories/admin, 나머지는 /categories?with_category_admin=1.
export function useCategories() {
  const { i18n } = useTranslation()
  const { data: me } = useMe()
  const isOfficeAdmin = !!me?.is_admin
  return useQuery({
    queryKey: ['categories', isOfficeAdmin ? 'admin' : 'user', i18n.language],
    queryFn: () =>
      isOfficeAdmin ? selectAdminCategory(i18n.language) : selectCategory(i18n.language),
    // me가 아직 없으면 기다린다 — 관리자인데 일반 트리를 먼저 캐싱하는 걸 방지
    enabled: isAuthenticated() && !!me,
    staleTime: 5 * 60 * 1000,
  })
}

// 개인 알림 설정(환경 설정 › 일반)은 Go /categories의 사용자 범위를 사용한다.
// queryKey는 useCategories의 비관리자 분기와 동일해 캐시를 공유한다.
export function useMemberCategories() {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['categories', 'user', i18n.language],
    queryFn: () => selectCategory(i18n.language),
    enabled: isAuthenticated(),
    staleTime: 5 * 60 * 1000,
  })
}
