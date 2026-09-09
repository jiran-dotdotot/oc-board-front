import { AUTH_SESSION_KEY } from '@/constants/auth'
import type { AuthSession, LoginResponse } from '@/types/auth'

// 세션은 OfficeWave 로그인 응답으로 만든다(`ebff9af` 이후 게시판 자체 발급 토큰은 없다).
// 토큰 쌍·스코프(company_id/user_id)·agent_id 를 한 덩어리로 교체한다.
export function getAuthSession(): AuthSession | null {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) ?? 'null')
    return session &&
      typeof session.id === 'string' &&
      session.id &&
      typeof session.access_token === 'string' &&
      session.access_token &&
      typeof session.refresh_token === 'string' &&
      session.refresh_token &&
      Number.isSafeInteger(session.company_id) &&
      Number.isSafeInteger(session.user_id)
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
  response: Pick<
    LoginResponse,
    'access_token' | 'refresh_token' | 'company_id' | 'user_id' | 'agent_id'
  >,
  sessionId: string = crypto.randomUUID(),
): void {
  if (
    typeof response.access_token !== 'string' ||
    !response.access_token ||
    typeof response.refresh_token !== 'string' ||
    !response.refresh_token ||
    !Number.isSafeInteger(response.company_id) ||
    !Number.isSafeInteger(response.user_id)
  ) {
    // 스코프가 없으면 `PathScope` 가 대조할 값이 없어 게시판 경로를 만들 수 없다(403).
    throw new Error('Invalid OfficeWave token response')
  }
  localStorage.setItem(
    AUTH_SESSION_KEY,
    JSON.stringify({
      id: sessionId,
      access_token: response.access_token,
      refresh_token: response.refresh_token,
      company_id: response.company_id,
      user_id: response.user_id,
      // 브라우저 로그인은 항상 null 이다. 숫자가 오면 그때만 쿼리에 실린다.
      agent_id: typeof response.agent_id === 'number' ? response.agent_id : null,
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

/**
 * 요청 스코프(`{company_id}`/`{user_id}`)를 정한다. **세션 값이 1순위**이고, 세션이 없을 때만
 * 토큰을 디코딩한다. 인증 검증이 아니다 — 권한은 서버가 판정한다.
 *
 * ⚠️ OfficeWave 토큰의 `sub` 는 `'Authorization'` 이고 `agent_id` 는 하드코딩 null 이다
 * (`OvHelper:102-121`). 예전 board 토큰 전제(`iss === 'oc-api-go/board'`, `sub === user_id`)로
 * 거르면 여기서 항상 null 이 나오고, 그러면 `boardApi.boardScope()` 의 경로 접두사와
 * `getCurrentUserId()`(자료실 「내 파일」 판정)가 조용히 전부 죽는다.
 */
export function getTokenIdentity(token = getAccessToken()) {
  const session = getAuthSession()
  if (session) return { userId: session.user_id, companyId: session.company_id }
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    if (
      !Number.isSafeInteger(claims.user_id) ||
      !Number.isSafeInteger(claims.company_id) ||
      !Array.isArray(claims.scopes) ||
      !claims.scopes.includes('ROLE_MEMBER')
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
