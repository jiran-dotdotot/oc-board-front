// Go(board) 경로 — `ebff9af` 에서 자격증명 3경로(`/board/{token,login,refresh}`)가 삭제됐다.
// 남은 것은 신원 조회 하나뿐이고 계약은 member(OfficeWave ES256)다.
// 근거: docs/api/backend-replies/board-auth-contract-change.md
export const AUTH_PATHS = {
  me: '/board/me',
} as const

/**
 * OfficeWave(`oc-api-laravel`) 자격증명 경로. base 는 `VITE_OV_API_URL`(→ `ovApiClient`).
 * - 로그인은 password grant 다: `{grant_type:'password', type:'browser', authority:'normal', username, password}`
 *   생태계 관례와 동일하다(`oc-web-messenger/services/auth.ts:48`). `cin` 은 요구하지 않는다.
 * - `refresh-token`·`logout` 은 라우트 주석이 `?agent_id=` 를 달고 있지만 **본문·JWT 로만 동작**한다
 *   (쿼리 `agent_id` 를 읽는 곳은 레이트리밋 하나뿐 — RouteServiceProvider:109).
 */
export const OV_AUTH_PATHS = {
  login: '/oauth/login',
  refresh: '/refresh-token',
  logout: '/logout',
} as const

export const AUTH_SESSION_KEY = 'oc-board-go-session'
