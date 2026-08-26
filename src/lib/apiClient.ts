import { clearTokens, getAccessToken } from '@/lib/authStorage'
import axios from 'axios'

/**
 * 공용 HTTP 클라이언트 (axios).
 * baseURL은 Vite 환경변수 VITE_API_URL에서 읽고, 없으면 동일 출처 '/api'로 폴백.
 * ⚠️ 전역 auth/error 인터셉터 파일 — 수정 전 팀 확인(CLAUDE.md).
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

// 요청: 저장된 access token이 있으면 Authorization 헤더 부착.
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 응답: 401(만료/무효) → 토큰 정리 후 로그인으로. (로그인 요청 자체는 제외)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    const url: string = error?.config?.url ?? ''
    if (status === 401 && !url.includes('/login')) {
      clearTokens()
      if (window.location.pathname !== '/login') window.location.assign('/login')
    }
    return Promise.reject(error)
  },
)

export default apiClient
