import { getAuthSession } from '@/lib/authStorage'
import type { InternalAxiosRequestConfig } from 'axios'

/**
 * `agent_id` 쿼리 부착 — 두 axios 인스턴스가 이 함수 하나만 쓴다(서비스마다 손으로 붙이지 않는다).
 *
 * ⚠️ **브라우저에는 붙일 값이 없다.** `type=browser` 로그인은 Agent 행을 만들지 않아 응답
 * `agent_id` 가 항상 null 이고(`AccountController:467`) JWT 도 `agent_id` 를 하드코딩 null 로
 * 넣는다(`OvHelper:120`). 생태계 웹들도 브라우저에서 이 쿼리를 보내지 않는다
 * (`oc-web-admin` logout · `oc-web-messenger` refresh-token 모두 쿼리 없음).
 *
 * 그래서 값이 **숫자일 때만** 넣고, 없으면 키를 만들지 않는다 — 생략과 빈값은 같은 뜻이 아니다.
 * (서버가 이 쿼리를 읽는 곳은 레이트리밋 하나뿐이고, 빈값이라도 있으면 120회/분 제한이 켜진다:
 * `RouteServiceProvider:109`.) PC 에이전트 배포에서 세션에 실제 id 가 들어오면 자동으로 붙는다.
 */
export function attachAgentId(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const agentId = getAuthSession()?.agent_id
  if (typeof agentId !== 'number' || !Number.isFinite(agentId)) return config
  config.params = { ...(config.params as Record<string, unknown> | undefined), agent_id: agentId }
  return config
}
