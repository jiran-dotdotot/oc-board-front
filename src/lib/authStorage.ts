import { AUTH_SESSION_KEY } from '@/constants/auth'
import type { AuthSession, LoginResponse } from '@/types/auth'

// Go 세션은 이전 Laravel 토큰/프로필과 분리하고 토큰 쌍을 한 번에 교체한다.
export function getAuthSession(): AuthSession | null {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) ?? 'null')
    return session &&
      typeof session.id === 'string' &&
      session.id &&
      typeof session.access_token === 'string' &&
      session.access_token &&
      typeof session.refresh_token === 'string' &&
      session.refresh_token
      ? session
      : null
  } catch {
    return null
  }
}

export function getAccessToken(): string | null {
  return getAuthSession()?.access_token ?? null
}

export function getRefreshToken(): string | null {
  return getAuthSession()?.refresh_token ?? null
}

export function setTokens(
  response: Pick<LoginResponse, 'access_token' | 'refresh_token'>,
  sessionId: string = crypto.randomUUID(),
): void {
  if (
    typeof response.access_token !== 'string' ||
    !response.access_token ||
    typeof response.refresh_token !== 'string' ||
    !response.refresh_token
  ) {
    throw new Error('Invalid board token response')
  }
  localStorage.setItem(
    AUTH_SESSION_KEY,
    JSON.stringify({
      id: sessionId,
      access_token: response.access_token,
      refresh_token: response.refresh_token,
    } satisfies AuthSession),
  )
  for (const key of ['oc-board-token', 'oc-board-refresh', 'oc-board-me']) {
    localStorage.removeItem(key)
  }
}

export function clearTokens(): void {
  localStorage.removeItem(AUTH_SESSION_KEY)
  for (const key of ['oc-board-token', 'oc-board-refresh', 'oc-board-me']) {
    localStorage.removeItem(key)
  }
}

export function isAuthenticated(): boolean {
  return getAuthSession() !== null
}

// UI/응답 일치 확인용 디코딩일 뿐 인증 검증이 아니다. 권한은 서버가 판정한다.
export function getTokenIdentity(token = getAccessToken()) {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    if (
      claims.iss !== 'oc-api-go/board' ||
      !Number.isSafeInteger(claims.user_id) ||
      !Number.isSafeInteger(claims.company_id) ||
      claims.sub !== String(claims.user_id)
    )
      return null
    return { userId: claims.user_id as number, companyId: claims.company_id as number }
  } catch {
    return null
  }
}

export function getCurrentUserId(): number | null {
  return getTokenIdentity()?.userId ?? null
}
