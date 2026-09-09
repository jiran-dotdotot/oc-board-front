// docs/api/go/01-auth-user.md — login/token/refresh의 TokenBody.

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token_type: 'Bearer'
  expires_in: number // access TTL 초. refresh 만료시각이 아니다.
  access_token: string
  refresh_token: string
  $schema?: string
}

export interface AuthSession {
  id: string // 로그인마다 새 식별자를 만들고 refresh 중에는 유지한다.
  access_token: string
  refresh_token: string
}
