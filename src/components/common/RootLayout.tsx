import { useEffect } from 'react'

import { Outlet, useLocation } from '@tanstack/react-router'

import { AppShell } from '@/components/common/AppShell'
import { AUTH_SESSION_KEY } from '@/constants/auth'
import { getAuthSession } from '@/lib/authStorage'
import { queryClient } from '@/lib/queryClient'

export function RootLayout() {
  const { pathname } = useLocation()

  useEffect(() => {
    const sessionId = getAuthSession()?.id
    const onStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_SESSION_KEY && event.key !== null) return
      if (getAuthSession()?.id === sessionId) return // 같은 세션의 refresh는 유지한다.
      queryClient.clear()
      window.location.assign('/login')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [pathname])

  // 로그인 등 풀스크린 화면은 셸 없이 렌더. 그 외 인앱 화면은 공통 셸로 감쌈.
  if (pathname === '/login') return <Outlet />

  return <AppShell />
}
