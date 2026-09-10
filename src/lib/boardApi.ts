import { apiClient } from '@/lib/apiClient'
import { getAuthSession, getTokenIdentity } from '@/lib/authStorage'
import { type AxiosRequestConfig, type AxiosResponse, CanceledError } from 'axios'

// Go board scope는 /me나 화면 필터가 아니라 요청 세션의 JWT에서 가져온다.
// 스코프 경로의 {company_id}/{user_id}는 토큰과 «문자열»까지 같아야 하고, 다르면 403이다
// (docs/api/go/README.md, 각 도메인 §2 Path).
function sessionScope(config: AxiosRequestConfig) {
  const session = getAuthSession()
  const identity = session && getTokenIdentity(session.access_token)
  if (!session || !identity) throw new CanceledError('Board session identity is unavailable')
  return { identity, config: { ...config, authSessionId: session.id } }
}

function boardScope(config: AxiosRequestConfig) {
  const { identity, config: scopedConfig } = sessionScope(config)
  return {
    prefix: `/board/companies/${identity.companyId}/users/${identity.userId}`,
    config: scopedConfig,
  }
}

/**
 * 관리 도메인 전용. **company 스코프까지만이고 `/users/{user_id}` 세그먼트가 없다** —
 * `ebff9af` 에서 `/api/v1/board/companies/{company_id}/…` 로 이사했고 본인은 `/users/me`
 * 리터럴이다(backend-replies/staleness-ebff9af.md §3). 게시판 리소스와 경로 모양이 다르므로
 * `boardScope` 를 재사용하지 않는다.
 */
export async function patchCompanyResource<T>(
  path: string,
  body?: unknown,
  config: AxiosRequestConfig = {},
): Promise<AxiosResponse<T>> {
  const { identity, config: scopedConfig } = sessionScope(config)
  return apiClient.patch<T>(`/board/companies/${identity.companyId}${path}`, body, scopedConfig)
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
