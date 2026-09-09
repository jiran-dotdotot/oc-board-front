// 인증 API 서비스. HTTP는 apiClient(axios), 토큰 저장은 authStorage.
import { AUTH_PATHS } from '@/constants/auth'
import { apiClient } from '@/lib/apiClient'
import { clearTokens, getAuthSession, setTokens } from '@/lib/authStorage'
import { queryClient } from '@/lib/queryClient'
import type { LoginRequest, LoginResponse } from '@/types/auth'
import { CanceledError } from 'axios'

let loginAttempt = 0

// Go /board/login. credential 원문을 보내며 trim/추가 필드를 적용하지 않는다.
export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const attempt = ++loginAttempt
  const previousSession = getAuthSession()?.id
  const { data } = await apiClient.post<LoginResponse>(AUTH_PATHS.login, payload, {
    timeout: 30_000,
  })
  if (attempt !== loginAttempt || getAuthSession()?.id !== previousSession) {
    throw new CanceledError('Authentication session changed')
  }
  if (data.token_type !== 'Bearer' || !data.access_token || !data.refresh_token) {
    throw new Error('Invalid board token response')
  }
  queryClient.clear()
  setTokens(data)
  return data
}

export function logout(): void {
  loginAttempt++
  clearTokens()
  queryClient.clear()
}
