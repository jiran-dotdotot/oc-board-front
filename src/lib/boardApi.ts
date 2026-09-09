import { apiClient } from '@/lib/apiClient'
import { getAuthSession, getTokenIdentity } from '@/lib/authStorage'
import { type AxiosRequestConfig, type AxiosResponse, CanceledError } from 'axios'

// Go board scope는 /me나 화면 필터가 아니라 요청 세션의 JWT에서 가져온다.
// 스코프 경로의 {company_id}/{user_id}는 토큰과 «문자열»까지 같아야 하고, 다르면 403이다
// (docs/api/go/README.md, 각 도메인 §2 Path).
function boardScope(config: AxiosRequestConfig) {
  const session = getAuthSession()
  const identity = session && getTokenIdentity(session.access_token)
  if (!session || !identity) throw new CanceledError('Board session identity is unavailable')
  return {
    prefix: `/board/companies/${identity.companyId}/users/${identity.userId}`,
    config: { ...config, authSessionId: session.id },
  }
}

export async function getBoardResource<T>(path: string, config: AxiosRequestConfig = {}) {
  const { prefix, config: scoped } = boardScope(config)
  return apiClient.get<T>(prefix + path, scoped)
}

/**
 * 스코프 경로의 쓰기 계열. GET 과 같은 세션 고정을 쓰되 메서드별로 갈라 둔다 —
 * DELETE 는 axios 에서 body 를 `data` 로 넘겨야 해서 서명이 다르다.
 */
export async function postBoardResource<T>(
  path: string,
  body?: unknown,
  config: AxiosRequestConfig = {},
): Promise<AxiosResponse<T>> {
  const { prefix, config: scoped } = boardScope(config)
  return apiClient.post<T>(prefix + path, body, scoped)
}

export async function putBoardResource<T>(
  path: string,
  body?: unknown,
  config: AxiosRequestConfig = {},
): Promise<AxiosResponse<T>> {
  const { prefix, config: scoped } = boardScope(config)
  return apiClient.put<T>(prefix + path, body, scoped)
}

export async function deleteBoardResource<T>(
  path: string,
  body?: unknown,
  config: AxiosRequestConfig = {},
): Promise<AxiosResponse<T>> {
  const { prefix, config: scoped } = boardScope(config)
  return apiClient.delete<T>(prefix + path, { ...scoped, data: body })
}
