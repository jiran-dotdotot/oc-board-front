// 인증 관련 타입 (실제 API 응답 기준 — POST /login)

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token_type: string // "Bearer"
  expires_in: number // 초 단위
  access_token: string
  refresh_token: string
}
