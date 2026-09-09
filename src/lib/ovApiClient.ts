import { OV_AUTH_PATHS } from '@/constants/auth'
import { attachAgentId } from '@/lib/agentQuery'
import { getAccessToken } from '@/lib/authStorage'
import axios from 'axios'

/**
 * OfficeWave(`oc-api-laravel`) 전용 axios. **자격증명 3경로만** 이 인스턴스로 나간다
 * (로그인·토큰 재발급·로그아웃). 게시판 리소스는 Go 쪽 `apiClient` 가 담당한다 —
 * `ebff9af` 이후 호스트가 둘로 갈렸다.
 *
 * - base 는 `VITE_OV_API_URL`(`/api/v1` 까지). 없으면 같은 출처의 `/api/v1` 로 떨어진다.
 * - **`withCredentials` 는 쓰지 않는다.** 생태계(`oc-web-messenger/utils/axios.ts:33`)는 켜 두지만
 *   이 앱은 쿠키를 하나도 읽지 않는다(토큰은 응답 본문으로 온다). 켜면 `Access-Control-Allow-Origin: *`
 *   가 무효가 되어 서버·목킹 양쪽에 정확한 출처 반영이 필요해지고, 실패 모드만 늘어난다.
 * - 상태코드 규약이 Go 와 다르다: **419 = JWT 만료(갱신 필요)** · 410 = 세션 만료 ·
 *   412 = 비밀번호 변경 필요 · 422 = 검증 실패(docs/api/api-spec.md:195-220).
 *   여기서는 인터셉터로 삼키지 않고 그대로 올린다 — 갱신 트리거는 Go 응답(401)이고,
 *   자격증명 호출의 오류는 로그인 화면이 문구로 바꿔 보여 준다.
 */
export const ovApiClient = axios.create({
  baseURL: import.meta.env.VITE_OV_API_URL?.trim() || '/api/v1',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

ovApiClient.interceptors.request.use((config) => {
  if (config.url === OV_AUTH_PATHS.login) {
    // 로그인에는 이전 세션 토큰이 붙지 않아야 한다(다른 계정 토큰으로 검증되면 안 된다).
    config.headers.delete('Authorization')
  } else {
    // 로그아웃은 Bearer 로 대상을 정한다(`AccountController:1319` 가 bearerToken 을 읽는다).
    // 재발급은 본문의 refresh_token 으로 동작하지만 헤더가 있어도 무해하다.
    const token = getAccessToken()
    if (token && !config.headers.has('Authorization'))
      config.headers.set('Authorization', `Bearer ${token}`)
  }
  return attachAgentId(config)
})

export default ovApiClient
