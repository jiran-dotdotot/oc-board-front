// 토큰 저장소 (localStorage). apiClient·authService 양쪽이 공유하므로 별도 모듈로 분리(순환 import 방지).
import type { LoginResponse } from '@/types/auth'
import type { Me } from '@/types/user'

const ACCESS_KEY = 'oc-board-token'
const REFRESH_KEY = 'oc-board-refresh'
const ME_KEY = 'oc-board-me'

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function setTokens(res: Pick<LoginResponse, 'access_token' | 'refresh_token'>): void {
  localStorage.setItem(ACCESS_KEY, res.access_token)
  localStorage.setItem(REFRESH_KEY, res.refresh_token)
  localStorage.removeItem(ME_KEY) // 새 로그인 → 이전 사용자 정보 무효화(다음 /me로 갱신)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(ME_KEY)
}

export function isAuthenticated(): boolean {
  return !!getAccessToken()
}

// 로그인 사용자 정보(/me) 캐시 — 새로고침에도 재호출 없이 재사용. 로그인/로그아웃 시 무효화됨.
export function getStoredMe(): Me | null {
  const raw = localStorage.getItem(ME_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Me
  } catch {
    return null
  }
}

export function setStoredMe(me: Me): void {
  try {
    localStorage.setItem(ME_KEY, JSON.stringify(me))
  } catch {
    /* localStorage 불가/용량초과 무시 */
  }
}

// access token(JWT)의 sub 클레임에서 현재 사용자 id를 읽음 (검증 없이 payload만 디코드).
export function getCurrentUserId(): number | null {
  const token = getAccessToken()
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return json.sub != null ? Number(json.sub) : null
  } catch {
    return null
  }
}
