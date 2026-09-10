import { createFileRoute } from '@tanstack/react-router'

import { LoginScreen } from '@/components/auth/LoginScreen'

export interface LoginSearch {
  /** 로그인 뒤 돌아갈 같은 출처의 경로(`/board/…?page=2`). 미인증 진입 시 루트 가드가 채운다. */
  redirect?: string
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    const r = typeof search.redirect === 'string' ? search.redirect : ''
    // 절대 URL·`//host` 는 버린다 — 열린 리다이렉트 방지. 앱 내부 경로만 허용.
    return { redirect: r.startsWith('/') && !r.startsWith('//') ? r : undefined }
  },
  // 세션이 있어도 /login 은 그대로 보여 준다(레거시 router/index.ts:14 와 같다) — 재로그인·계정 전환 경로.
  component: LoginScreen,
})
