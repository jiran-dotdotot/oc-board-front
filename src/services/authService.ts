// 인증 API 서비스. HTTP는 apiClient(axios), 토큰 저장은 authStorage.
import { apiClient } from '@/lib/apiClient'
import { clearTokens, setTokens } from '@/lib/authStorage'
import type { LoginRequest, LoginResponse } from '@/types/auth'

// POST /login → 토큰 발급 + 저장. baseURL(VITE_API_URL)에 이어붙음.
export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/login', payload)
  setTokens(data)
  return data
}

export function logout(): void {
  clearTokens()
}
