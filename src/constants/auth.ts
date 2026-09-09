// docs/api/go/01-auth-user.md — VITE_API_URL은 /api/v1까지 포함한다.
export const AUTH_PATHS = {
  login: '/board/login',
  token: '/board/token',
  refresh: '/board/refresh',
  me: '/board/me',
} as const

export const AUTH_SESSION_KEY = 'oc-board-go-session'
