import { createRootRoute, redirect } from '@tanstack/react-router'

import { RootLayout } from '@/components/common/RootLayout'
import { isAuthenticated } from '@/lib/authStorage'

export const Route = createRootRoute({
  // 세션이 없으면 어떤 화면도 데이터가 없다 — /login 으로 보내고 원래 주소를 `redirect` 에 싣는다
  // (레거시 router/index.ts:23-25 와 같은 규칙). 세션 검사는 로컬 저장소만 보며 권한 판정이 아니다.
  beforeLoad: ({ location }) => {
    if (location.pathname === '/login' || isAuthenticated()) return
    throw redirect({
      to: '/login',
      search: location.href === '/' ? {} : { redirect: location.href },
      replace: true,
    })
  },
  component: RootLayout,
})
