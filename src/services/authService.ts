// 인증 API 서비스. 자격증명은 OfficeWave(`ovApiClient`), 토큰 저장은 authStorage.
import { OV_AUTH_PATHS } from '@/constants/auth'
import { clearTokens, getAuthSession, setTokens } from '@/lib/authStorage'
import { ovApiClient } from '@/lib/ovApiClient'
import { queryClient } from '@/lib/queryClient'
import type { LoginRequest, LoginResponse } from '@/types/auth'
import { CanceledError } from 'axios'

let loginAttempt = 0

/** 브라우저 클라이언트가 고정으로 보내는 값. `type` 이 아니면 `uuid` 가 필수가 된다. */
const CLIENT_KIND = { type: 'browser', authority: 'normal' } as const

/**
 * OfficeWave 로그인(`POST /oauth/login`, password grant).
 * Laravel 이 통합인증 서버에 `client_id`/`client_secret` 을 대리 전송하므로 프론트는
 * 자격증명만 보낸다(`AccountController:619`). `cin` 은 요구되지 않는다.
 * credential 원문을 보내며 trim·추가 필드를 적용하지 않는다.
 */
export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const attempt = ++loginAttempt
  const previousSession = getAuthSession()?.id
  const { data } = await ovApiClient.post<LoginResponse>(OV_AUTH_PATHS.login, {
    grant_type: 'password',
    ...CLIENT_KIND,
    ...payload,
  })
  if (attempt !== loginAttempt || getAuthSession()?.id !== previousSession) {
    throw new CanceledError('Authentication session changed')
  }
  assertMemberToken(data)
  queryClient.clear()
  setTokens(data)
  return data
}

/**
 * 토큰 재발급(`POST /refresh-token`). 본문의 `refresh_token` 으로 동작하며 쿼리
 * `agent_id` 는 쓰이지 않는다(서버는 JWT 에서 읽는다 — `AccountController:1187`).
 * 만료 신호는 OfficeWave 가 419, Go 가 401 이다.
 */
export async function refreshTokens(refreshToken: string): Promise<LoginResponse> {
  const { data } = await ovApiClient.post<LoginResponse>(OV_AUTH_PATHS.refresh, {
    ...CLIENT_KIND,
    refresh_token: refreshToken,
  })
  assertMemberToken(data)
  return data
}

/**
 * 로그아웃. 서버 세션도 끊어야 하므로 `POST /logout` 을 먼저 시도하지만(Bearer 로 대상 지정),
 * 실패해도 로컬 정리는 반드시 진행한다 — 로컬에 토큰이 남는 것이 더 나쁘다.
 */
export async function logout(): Promise<void> {
  loginAttempt++
  // 로컬을 먼저 지우므로 헤더는 지우기 «전» 토큰으로 직접 실어야 한다
  // (인터셉터는 스토리지를 읽고, 그때는 이미 비어 있다 → 서버가 대상을 못 정한다).
  const token = getAuthSession()?.access_token
  clearTokens()
  queryClient.clear()
  if (!token) return
  try {
    await ovApiClient.post(OV_AUTH_PATHS.logout, undefined, {
      timeout: 5_000,
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    // best-effort. 서버 세션 만료는 다음 로그인에서 정리된다.
  }
}

/**
 * 응답이 **Go 에서 쓸 수 있는** member 토큰인지 확인한다.
 * `ROLE_MEMBER` 가 없으면 게시판 전 경로가 401 이므로 로그인 단계에서 잡는다
 * (`oc-api-go/internal/auth/jwt.go:27,162`).
 */
function assertMemberToken(data: LoginResponse): void {
  if (data.token_type !== 'Bearer' || !data.access_token || !data.refresh_token) {
    throw new Error('Invalid OfficeWave token response')
  }
  if (!Array.isArray(data.scopes) || !data.scopes.includes('ROLE_MEMBER')) {
    throw new Error('Token has no ROLE_MEMBER scope')
  }
}
