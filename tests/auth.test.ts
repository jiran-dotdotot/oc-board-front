import { AUTH_PATHS, AUTH_SESSION_KEY } from '@/constants/auth'
import { apiClient } from '@/lib/apiClient'
import { clearTokens, getAuthSession, getRefreshToken, setTokens } from '@/lib/authStorage'
import { queryClient } from '@/lib/queryClient'
import { login, logout } from '@/services/authService'
import { getMe } from '@/services/userService'
import type { LoginResponse } from '@/types/auth'
import { type AxiosAdapter, AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const jwt = (user = 1, company = 1, revision = 0) =>
  'header.' +
  btoa(
    JSON.stringify({
      iss: 'oc-api-go/board',
      sub: String(user),
      user_id: user,
      company_id: company,
      revision,
    }),
  ) +
  '.signature'
const tokens = (revision = 0, user = 1): LoginResponse => ({
  token_type: 'Bearer',
  expires_in: 3600,
  access_token: jwt(user, 1, revision),
  refresh_token: 'refresh-' + user + '-' + revision,
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
  clearTokens()
  queryClient.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Go authentication contract', () => {
  it('login sends original credentials without bearer, replaces the session and clears user queries', async () => {
    setTokens(tokens())
    const oldId = getAuthSession()!.id
    queryClient.setQueryData(['private-posts'], ['old user data'])
    apiClient.defaults.adapter = (async (config) => {
      expect(config.url).toBe(AUTH_PATHS.login)
      expect(config.headers.get('Authorization')).toBeUndefined()
      expect(JSON.parse(config.data)).toEqual({ username: ' user ', password: ' password ' })
      return reply(config, 200, tokens(0, 2))
    }) satisfies AxiosAdapter
    await login({ username: ' user ', password: ' password ' })
    expect(getAuthSession()!.id).not.toBe(oldId)
    expect(getAuthSession()!.access_token).toBe(jwt(2))
    expect(queryClient.getQueryData(['private-posts'])).toBeUndefined()
  })

  it.each([AUTH_PATHS.login, AUTH_PATHS.token, AUTH_PATHS.refresh])(
    '%s failures never refresh or redirect',
    async (url) => {
      setTokens(tokens())
      const session = getAuthSession()
      const adapter = vi.fn(async (config) => reply(config, 401))
      apiClient.defaults.adapter = adapter
      await expect(apiClient.post(url, {})).rejects.toMatchObject({ response: { status: 401 } })
      expect(adapter).toHaveBeenCalledTimes(1)
      expect(getAuthSession()).toEqual(session)
      expect(redirect).not.toHaveBeenCalled()
    },
  )

  it('concurrent 401s consume refresh once and replay with the rotated pair', async () => {
    setTokens(tokens())
    const id = getAuthSession()!.id
    let refreshes = 0
    let retried = 0
    apiClient.defaults.adapter = async (config) => {
      if (config.url === AUTH_PATHS.refresh) {
        refreshes++
        expect(config.headers.get('Authorization')).toBeUndefined()
        expect(JSON.parse(config.data)).toEqual({ refresh_token: tokens().refresh_token })
        return reply(config, 200, tokens(1))
      }
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
    })
  })

  it.each([401, 403, 500, 'network'])(
    'refresh %s retires a possibly consumed token without retrying it',
    async (failure) => {
      setTokens(tokens())
      let refreshes = 0
      apiClient.defaults.adapter = async (config) => {
        if (config.url !== AUTH_PATHS.refresh) return reply(config, 401)
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

  it('a previous login request is not replayed using another user token', async () => {
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
    apiClient.defaults.adapter = async (config) => {
      if (config.url !== AUTH_PATHS.refresh) return reply(config, 401)
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

  it('me uses Go path and Lang, preserves null relations without a persisted legacy profile', async () => {
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

  it('member paths do not receive board tokens or refresh the board session', async () => {
    setTokens(tokens())
    apiClient.defaults.adapter = async (config) => {
      expect(config.headers.get('Authorization')).toBeUndefined()
      return reply(config, 401)
    }
    await expect(apiClient.get('/companies/1/settings')).rejects.toBeDefined()
    expect(getRefreshToken()).toBe(tokens().refresh_token)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('logout removes authentication and private query data', () => {
    setTokens(tokens())
    localStorage.setItem('oc-board-token', 'legacy')
    localStorage.setItem('oc-board-me', '{}')
    queryClient.setQueryData(['private-posts'], ['private'])
    logout()
    expect(localStorage.getItem(AUTH_SESSION_KEY)).toBeNull()
    expect(localStorage.getItem('oc-board-token')).toBeNull()
    expect(localStorage.getItem('oc-board-me')).toBeNull()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })
})
