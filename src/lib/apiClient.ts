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

// 요청: 저장된 토큰이 있으면 Authorization 헤더 부착. (auth 스토어 연결 지점)
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('oc-board-token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 응답: 전역 에러 처리 지점. (예: 401 → 로그인 유도 등을 여기에 연결)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
)

export default apiClient
