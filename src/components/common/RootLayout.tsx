import { Outlet, useLocation } from '@tanstack/react-router'

import { AppShell } from '@/components/common/AppShell'

export function RootLayout() {
  const { pathname } = useLocation()

  // 로그인 등 풀스크린 화면은 셸 없이 렌더. 그 외 인앱 화면은 공통 셸로 감쌈.
  if (pathname === '/login') return <Outlet />

  return <AppShell />
}
