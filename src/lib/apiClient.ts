import { AUTH_PATHS } from '@/constants/auth'
import { clearTokens, getAuthSession, setTokens } from '@/lib/authStorage'
import i18n from '@/lib/i18n'
import { queryClient } from '@/lib/queryClient'
import type { AuthSession, LoginResponse } from '@/types/auth'
import axios, { CanceledError, type InternalAxiosRequestConfig } from 'axios'

type AuthRequestConfig = InternalAxiosRequestConfig & {
  authSessionId?: string
  authRetry?: boolean
}

/** VITE_API_URL은 Go의 /api/v1까지. 인증 경로는 /board 아래다. */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL?.trim() || '/api/v1',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

function isTokenRequest(url = '') {
  const path = url.split('?')[0]
  return path === AUTH_PATHS.login || path === AUTH_PATHS.token || path === AUTH_PATHS.refresh
}

function requireSameSession(id?: string) {
  const session = getAuthSession()
  if (!session || session.id !== id) throw new CanceledError('Authentication session changed')
  return session
}

export function expireSession(id?: string): void {
  if (!id || getAuthSession()?.id !== id) return
  clearTokens()
  queryClient.clear()
  if (window.location.pathname !== '/login') window.location.assign('/login')
}

apiClient.interceptors.request.use((config: AuthRequestConfig) => {
  if (isTokenRequest(config.url)) {
    config.headers.delete('Authorization')
  } else if (config.url?.startsWith('/board/')) {
    // member 인증 경로(/companies/…)에 board 토큰을 보내지 않는다.
    const session = config.authSessionId
      ? requireSameSession(config.authSessionId)
      : getAuthSession()
    if (session) {
      config.authSessionId = session.id
      config.headers.set('Authorization', `Bearer ${session.access_token}`)
    }
  }
  // Go는 Lang으로 표시명 언어를, Time_zone(밑줄)으로 입력 시각·로컬 day를 정한다
  // (docs/api/go/README.md:90-95). 빠지면 브라우저 Accept-Language로 떨어져
  // 앱 언어와 무관한 언어로 응답한다. 호출부가 이미 지정했으면 그 값을 남긴다.
  if (!config.headers.has('Lang')) config.headers.set('Lang', i18n.language)
  if (!config.headers.has('Time_zone'))
    config.headers.set('Time_zone', Intl.DateTimeFormat().resolvedOptions().timeZone)
  return config
})

async function refreshSession(config: AuthRequestConfig): Promise<AuthSession> {
  const requestToken = config.headers.get('Authorization')
  const refresh = async () => {
    if (config.signal?.aborted) throw new CanceledError()
    const session = requireSameSession(config.authSessionId)
    // 다른 요청/탭이 이미 회전했다면 일회용 refresh를 다시 소비하지 않는다.
    if (requestToken !== `Bearer ${session.access_token}`) return session
    try {
      const { data } = await apiClient.post<LoginResponse>(AUTH_PATHS.refresh, {
        refresh_token: session.refresh_token,
      })
      const current = requireSameSession(session.id)
      if (current.refresh_token !== session.refresh_token) return current
      if (data.token_type !== 'Bearer' || !data.access_token || !data.refresh_token) {
        throw new Error('Invalid board token response')
      }
      setTokens(data, session.id)
      return requireSameSession(session.id)
    } catch (error) {
      // 소비 뒤 403/500/응답 유실도 재사용 불가. 새 로그인 세션은 건드리지 않는다.
      if (getAuthSession()?.refresh_token === session.refresh_token) expireSession(session.id)
      throw error
    }
  }

  if (!navigator.locks) {
    // 탭 간 직렬화가 불가능한 환경에서는 재인증하여 refresh 재소비를 막는다.
    expireSession(config.authSessionId)
    throw new Error('Session renewal requires Web Locks')
  }
  return navigator.locks.request(`oc-board-refresh:${apiClient.defaults.baseURL}`, refresh)
}

apiClient.interceptors.response.use(
  (response) => {
    const config = response.config as AuthRequestConfig
    if (config.authSessionId) requireSameSession(config.authSessionId)
    return response
  },
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) throw error
    const config = error.config as AuthRequestConfig | undefined
    if (
      !config ||
      error.response?.status !== 401 ||
      isTokenRequest(config.url) ||
      !config.url?.startsWith('/board/')
    )
      throw error
    if (!config.authSessionId) throw error
    requireSameSession(config.authSessionId)
    if (config.authRetry) {
      expireSession(config.authSessionId)
      throw error
    }
    if (config.signal?.aborted) throw new CanceledError()
    config.authRetry = true
    await refreshSession(config)
    if (config.signal?.aborted) throw new CanceledError()
    return apiClient(config)
  },
)

export default apiClient
