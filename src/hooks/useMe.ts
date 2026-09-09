import { useQuery } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { getAuthSession } from '@/lib/authStorage'
import { getMe } from '@/services/userService'

// 현재 권한·소속을 다시 확인한다. 이전 백엔드 localStorage 프로필은 재사용하지 않는다.
export function useMe() {
  const { i18n } = useTranslation()
  const session = getAuthSession()
  return useQuery({
    queryKey: ['me', i18n.language, session?.id],
    queryFn: ({ signal }) => getMe(i18n.language, signal),
    enabled: !!session,
    retry: false,
  })
}
