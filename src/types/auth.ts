// OfficeWave(`oc-api-laravel`) 자격증명 계약. 근거: AccountController::oAuthLogin
// 응답 블록(:773-793) · docs/api/api-spec.md:240-320.

/** 화면이 받는 값. 서버로는 `username`/`password` 로 나간다(이메일도 account 로 처리된다). */
export interface LoginRequest {
  username: string
  password: string
}

/**
 * `POST /oauth/login` · `POST /refresh-token` 응답. 앱이 쓰는 필드만 좁혀 둔다.
 * ⚠️ `expired_in`(Go 의 `expires_in` 아님) 은 **초**이고 브라우저+normal 은 `EXPIRED_TIME`,
 *    admin 만 `SESSION_TIME` 이다(AccountController:786).
 * ⚠️ `agent_id` 는 **브라우저면 항상 null** 이다(:467). Agent 행 자체를 만들지 않는다.
 */
export interface LoginResponse {
  token_type: 'Bearer'
  access_token: string
  refresh_token: string
  expired_in: number
  company_id: number
  user_id: number
  /** `ROLE_MEMBER` 는 항상 포함된다. Go 는 이 스코프가 없으면 401 이다. */
  scopes: string[]
  agent_id: number | null
  cin?: string
  /** true 면 서버가 비밀번호 변경을 요구한다. 정본에 그 화면이 없어 이번 범위 밖이다(BR-036). */
  is_required_password_change?: boolean
  /** `mfa_required` 가 true 면 추가 인증이 필요하다. 역시 정본에 화면이 없다(BR-036). */
  mfa?: { mfa_required?: boolean; mfa_start_url?: string; mfa_challenge_url?: string }
}

export interface AuthSession {
  id: string // 로그인마다 새 식별자를 만들고 refresh 중에는 유지한다.
  access_token: string
  refresh_token: string
  /** PathScope 대조에 쓰는 스코프. 토큰 디코딩보다 이 값을 먼저 쓴다. */
  company_id: number
  user_id: number
  /** 브라우저는 null. 값이 있을 때만 요청에 `agent_id` 쿼리를 붙인다. */
  agent_id: number | null
}
