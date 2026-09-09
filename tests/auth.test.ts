import { AUTH_PATHS, AUTH_SESSION_KEY, OV_AUTH_PATHS } from '@/constants/auth'
import { apiClient } from '@/lib/apiClient'
import { clearTokens, getAuthSession, getRefreshToken, setTokens } from '@/lib/authStorage'
import { ovApiClient } from '@/lib/ovApiClient'
import { queryClient } from '@/lib/queryClient'
import { login, logout } from '@/services/authService'
import { getMe } from '@/services/userService'
import type { LoginResponse } from '@/types/auth'
import { type AxiosAdapter, AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/* OfficeWave(ES256) 토큰 모양. `sub` 는 'Authorization' 이고 `agent_id` 는 하드코딩 null 이다
   — 예전 board 토큰(`iss=oc-api-go/board`, `sub=user_id`)과 다르다(OvHelper:102-121). */
const jwt = (user = 1, company = 1, revision = 0) =>
  'header.' +
  btoa(
    JSON.stringify({
      iss: 'http://officewave',
      sub: 'Authorization',
      aud: 'browser',
      user_id: user,
      company_id: company,
      agent_id: null,
      agent_browser_id: 10 + revision,
      scopes: ['ROLE_MEMBER'],
      revision,
    }),
  ) +
  '.signature'
const tokens = (revision = 0, user = 1): LoginResponse => ({
  token_type: 'Bearer',
  expired_in: 7200,
  access_token: jwt(user, 1, revision),
  refresh_token: 'refresh-' + user + '-' + revision,
  company_id: 1,
  user_id: user,
  scopes: ['ROLE_MEMBER'],
  agent_id: null,
})
function reply(config: InternalAxiosRequestConfig, status: number, data: unknown = {}) {
  const response = { config, status, statusText: String(status), data, headers: new AxiosHeaders() }
  if (status >= 400) throw new AxiosError('API error', undefined, config, undefined, response)
  return response
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
const originalAdapter = apiClient.defaults.adapter
const originalOvAdapter = ovApiClient.defaults.adapter
let redirect: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, String(value)),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  })
  queryClient.clear()
  redirect = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
  let queue = Promise.resolve()
  // Model same-origin scheduling; native two-tab locks are checked in Playwright.
  vi.stubGlobal('navigator', {
    locks: {
      request: (_name: string, callback: () => Promise<unknown>) => {
        const result = queue.then(callback)
        queue = result.then(
          () => {},
          () => {},
        )
        return result
      },
    },
  })
})
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  ovApiClient.defaults.adapter = originalOvAdapter
  clearTokens()
  queryClient.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('OfficeWave authentication contract', () => {
  it('login posts the password grant without bearer, replaces the session and clears user queries', async () => {
    setTokens(tokens())
    const oldId = getAuthSession()!.id
    queryClient.setQueryData(['private-posts'], ['old user data'])
    ovApiClient.defaults.adapter = (async (config) => {
      expect(config.url).toBe(OV_AUTH_PATHS.login)
      expect(config.headers.get('Authorization')).toBeUndefined()
      // credential 원문 그대로 + 브라우저 고정값. `cin` 은 이 경로가 요구하지 않는다.
      expect(JSON.parse(config.data)).toEqual({
        grant_type: 'password',
        type: 'browser',
        authority: 'normal',
        username: ' user ',
        password: ' password ',
      })
      return reply(config, 200, tokens(0, 2))
    }) satisfies AxiosAdapter
    await login({ username: ' user ', password: ' password ' })
    const session = getAuthSession()!
    expect(session.id).not.toBe(oldId)
    expect(session.access_token).toBe(jwt(2))
    expect(session.user_id).toBe(2)
    expect(session.company_id).toBe(1)
    // 브라우저 로그인은 agent 를 만들지 않는다 → 쿼리에 붙일 값이 없다.
    expect(session.agent_id).toBeNull()
    expect(queryClient.getQueryData(['private-posts'])).toBeUndefined()
  })

  it('rejects a token without ROLE_MEMBER at login instead of letting every board call 401', async () => {
    ovApiClient.defaults.adapter = async (config) =>
      reply(config, 200, { ...tokens(), scopes: ['ROLE_GUEST'] })
    await expect(login({ username: 'u', password: 'p' })).rejects.toThrow('ROLE_MEMBER')
    expect(getAuthSession()).toBeNull()
  })

  it('rejects a response without company/user scope — PathScope has nothing to match', async () => {
    ovApiClient.defaults.adapter = async (config) =>
      reply(config, 200, { ...tokens(), company_id: undefined, user_id: undefined })
    await expect(login({ username: 'u', password: 'p' })).rejects.toThrow('Invalid OfficeWave')
    expect(getAuthSession()).toBeNull()
  })

  it('every Go path carries the member bearer and omits agent_id', async () => {
    setTokens(tokens())
    const seen: string[] = []
    apiClient.defaults.adapter = async (config) => {
      seen.push(config.url ?? '')
      expect(config.headers.get('Authorization')).toBe('Bearer ' + tokens().access_token)
      expect((config.params as Record<string, unknown> | undefined)?.agent_id).toBeUndefined()
      return reply(config, 200)
    }
    await Promise.all([apiClient.get(AUTH_PATHS.me), apiClient.get('/board/companies/1/users/1/x')])
    expect(seen).toHaveLength(2)
  })

  it('attaches agent_id only when the session actually has one (pc agent deployments)', async () => {
    setTokens({ ...tokens(), agent_id: 77 })
    apiClient.defaults.adapter = async (config) => {
      expect((config.params as Record<string, unknown>).agent_id).toBe(77)
      return reply(config, 200)
    }
    await apiClient.get(AUTH_PATHS.me)
  })

  it('concurrent 401s consume the OfficeWave refresh once and replay with the rotated pair', async () => {
    setTokens(tokens())
    const id = getAuthSession()!.id
    let refreshes = 0
    let retried = 0
    ovApiClient.defaults.adapter = async (config) => {
      expect(config.url).toBe(OV_AUTH_PATHS.refresh)
      refreshes++
      expect(JSON.parse(config.data)).toEqual({
        type: 'browser',
        authority: 'normal',
        refresh_token: tokens().refresh_token,
      })
      return reply(config, 200, tokens(1))
    }
    apiClient.defaults.adapter = async (config) => {
      if (config.headers.get('Authorization') === 'Bearer ' + tokens().access_token)
        return reply(config, 401)
      retried++
      expect(config.headers.get('Authorization')).toBe('Bearer ' + tokens(1).access_token)
      return reply(config, 200)
    }
    await Promise.all([
      apiClient.get('/board/a'),
      apiClient.get('/board/b'),
      apiClient.get('/board/c'),
    ])
    expect(refreshes).toBe(1)
    expect(retried).toBe(3)
    expect(getAuthSession()).toEqual({
      id,
      access_token: tokens(1).access_token,
      refresh_token: tokens(1).refresh_token,
      company_id: 1,
      user_id: 1,
      agent_id: null,
    })
  })

  it.each([401, 419, 403, 500, 'network'])(
    'refresh %s retires a possibly consumed token without retrying it',
    async (failure) => {
      setTokens(tokens())
      let refreshes = 0
      apiClient.defaults.adapter = async (config) => reply(config, 401)
      ovApiClient.defaults.adapter = async (config) => {
        refreshes++
        if (failure === 'network') throw new AxiosError('Response lost', 'ERR_NETWORK', config)
        return reply(config, Number(failure))
      }
      await Promise.allSettled([apiClient.get('/board/a'), apiClient.get('/board/b')])
      expect(refreshes).toBe(1)
      expect(getAuthSession()).toBeNull()
      expect(redirect).toHaveBeenCalledTimes(1)
    },
  )

  it('a previous request is not replayed using another user token', async () => {
    setTokens(tokens())
    const started = deferred<void>()
    const release = deferred<void>()
    let calls = 0
    apiClient.defaults.adapter = async (config) => {
      calls++
      started.resolve()
      await release.promise
      return reply(config, 401)
    }
    const request = apiClient.get('/board/a')
    await started.promise
    setTokens(tokens(0, 2))
    const next = getAuthSession()
    release.resolve()
    await expect(request).rejects.toMatchObject({ code: 'ERR_CANCELED' })
    expect(calls).toBe(1)
    expect(getAuthSession()).toEqual(next)
    expect(redirect).not.toHaveBeenCalled()
  })

  it.each([200, 500])('late refresh %s cannot overwrite or clear a new login', async (status) => {
    setTokens(tokens())
    const started = deferred<void>()
    const release = deferred<void>()
    apiClient.defaults.adapter = async (config) => reply(config, 401)
    ovApiClient.defaults.adapter = async (config) => {
      started.resolve()
      await release.promise
      return reply(config, status, tokens(1))
    }
    const request = apiClient.get('/board/a')
    await started.promise
    setTokens(tokens(0, 2))
    const next = getAuthSession()
    release.resolve()
    await expect(request).rejects.toBeDefined()
    expect(getAuthSession()).toEqual(next)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('me uses the Go path and Lang, preserving null relations', async () => {
    setTokens(tokens())
    const me = {
      id: 1,
      company_id: 1,
      name: null,
      member: null,
      company_setting: null,
      company_user_setting: null,
    }
    apiClient.defaults.adapter = async (config) => {
      expect(config.url).toBe(AUTH_PATHS.me)
      expect(config.headers.get('Lang')).toBe('ko')
      return reply(config, 200, me)
    }
    expect(await getMe('ko')).toEqual(me)
    expect(localStorage.getItem('oc-board-me')).toBeNull()
  })

  it('me company change requires reauthentication instead of inventing a new scope', async () => {
    setTokens(tokens())
    apiClient.defaults.adapter = async (config) => reply(config, 200, { id: 1, company_id: 2 })
    await expect(getMe('ko')).rejects.toMatchObject({ code: 'ERR_CANCELED' })
    expect(getAuthSession()).toBeNull()
    expect(redirect).toHaveBeenCalledTimes(1)
  })

  it('logout clears the session first and tells OfficeWave best-effort', async () => {
    setTokens(tokens())
    localStorage.setItem('oc-board-token', 'legacy')
    localStorage.setItem('oc-board-me', '{}')
    queryClient.setQueryData(['private-posts'], ['private'])
    let calls = 0
    ovApiClient.defaults.adapter = async (config) => {
      calls++
      expect(config.url).toBe(OV_AUTH_PATHS.logout)
      // 로컬을 먼저 지우므로 Bearer 를 직접 실어야 한다 — 없으면 서버 세션이 안 끊긴다.
      expect(config.headers.Authorization).toBe(`Bearer ${tokens().access_token}`)
      return reply(config, 500) // 서버가 실패해도 로컬 정리는 끝나 있어야 한다
    }
    await logout()
    expect(calls).toBe(1)
    expect(localStorage.getItem(AUTH_SESSION_KEY)).toBeNull()
    expect(localStorage.getItem('oc-board-token')).toBeNull()
    expect(localStorage.getItem('oc-board-me')).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })
})
