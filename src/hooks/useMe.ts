import { useQuery } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { getStoredMe, isAuthenticated } from '@/lib/authStorage'
import { getMe } from '@/services/userService'

// 로그인 사용자 정보. localStorage 시드(getStoredMe)로 새로고침 시 재호출 안 함.
// staleTime Infinity → 세션 내 재호출 없음. 로그인/로그아웃 때 localStorage·쿼리 무효화로 갱신.
export function useMe() {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['me', i18n.language],
    queryFn: () => getMe(i18n.language),
    enabled: isAuthenticated(),
    initialData: () => getStoredMe() ?? undefined,
    staleTime: Infinity,
  })
}
