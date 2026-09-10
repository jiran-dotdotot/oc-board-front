import { apiClient } from '@/lib/apiClient'
import { clearTokens, getAuthSession, setTokens } from '@/lib/authStorage'
import { selectBookmarkedBoards } from '@/services/boardService'
import { selectAdminCategory, selectCategory } from '@/services/categoryService'
import { selectDriveFiles } from '@/services/driveService'
import { selectNotices, selectPost } from '@/services/postService'
import { updateCompanySetting, updateUserSetting } from '@/services/settingService'
import { AxiosHeaders } from 'axios'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

/* OfficeWave(ES256) 토큰 + 세션 스코프. 경로의 회사·사용자는 이 값과 문자열까지 같아야 한다. */
const pair = (company = 7, user = 42) => ({
  access_token:
    'header.' +
    btoa(
      JSON.stringify({
        iss: 'http://officewave',
        sub: 'Authorization',
        company_id: company,
        user_id: user,
        scopes: ['ROLE_MEMBER'],
      }),
    ) +
    '.signature',
  refresh_token: 'fixture-refresh',
  company_id: company,
  user_id: user,
  agent_id: null,
})
const originalAdapter = apiClient.defaults.adapter
beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
})
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  clearTokens()
  vi.unstubAllGlobals()
})

it('all main list variants use board scope, bearer, Go queries and the matching response shape', async () => {
  const tokens = pair()
  setTokens(tokens)
  const paths: string[] = []
  const row = { id: 'fixture-item' }
  const envelope = { data: [row], current_page: 1, last_page: 1, per_page: 20, total: 1 }
  const tree = { public_boards: [row], categories: [] }
  apiClient.defaults.adapter = async (config) => {
    paths.push(config.url!)
    expect(config.method).toBe('get')
    expect(config.url).toMatch(/^\/board\/companies\/7\/users\/42\//)
    expect(config.headers.get('Authorization')).toBe('Bearer ' + tokens.access_token)
    expect(config.headers.get('Lang')).toBe('ja')
    const params = config.params ?? {}
    const uri = new URL(apiClient.getUri(config), 'http://fixture.test')
    if (config.url!.endsWith('/bookmarks')) expect(params).toEqual({ take: 100 })
    if (config.url!.endsWith('/categories')) expect(params).toEqual({ with_category_admin: 1 })
    if (config.url!.endsWith('/drive-files')) {
      expect(params).not.toHaveProperty('more_field')
      expect(params).not.toHaveProperty('user_id')
      expect(uri.searchParams.get('sort[value]')).toBe('report')
    }
    if (config.url!.endsWith('/posts')) {
      expect(uri.searchParams.get('is_view')).toBe('0')
      expect(uri.searchParams.has('title')).toBe(false)
      // 목록·공지 모두 페이지 봉투다 — is_not_paging 은 더 이상 보내지 않는다(BR-032).
      expect(uri.searchParams.has('is_not_paging')).toBe(false)
      if (uri.searchParams.getAll('badges[]').length) {
        expect(uri.searchParams.getAll('badges[]')).toEqual(['NOTICE'])
        expect(params.take).toBe(100)
      } else {
        expect(uri.searchParams.getAll('except_badges[]')).toEqual(['NOTICE'])
        expect(params.user_id).toBe(99) // author filter never changes the requester scope
      }
    }
    const data = config.url!.includes('/categories') ? tree : envelope
    return { config, data, status: 200, statusText: 'OK', headers: new AxiosHeaders() }
  }
  const fileParams = { sort: { by: 'relative', order: 'desc' as const, value: 'report' } }
  const results = await Promise.all([
    selectBookmarkedBoards('ja'),
    selectPost({ is_view: false, title: '', user_id: 99, except_badges: ['NOTICE'] }, 'ja'),
    selectNotices({ is_view: false }, 'ja'),
    selectDriveFiles(fileParams, 'ja'),
    selectCategory('ja'),
    selectAdminCategory('ja'),
  ])
  // 공지만 봉투에서 배열을 꺼내 돌려주고, 나머지는 각 함수의 계약대로다.
  expect(results).toEqual([[row], envelope, [row], envelope, tree, tree])
  expect(paths.map((path) => path.replace('/board/companies/7/users/42/', ''))).toEqual([
    'bookmarks',
    'posts',
    'posts',
    'drive-files',
    'categories',
    'categories/admin',
  ])
})

it('rejects a missing identity before network access', async () => {
  const adapter = vi.fn()
  apiClient.defaults.adapter = adapter
  await expect(selectPost({}, 'ko')).rejects.toMatchObject({ code: 'ERR_CANCELED' })
  expect(adapter).not.toHaveBeenCalled()
})

it.each([
  ['scope 없는 응답', { access_token: 'a.b.c', refresh_token: 'r' }],
  ['company_id 만 있는 응답', { access_token: 'a.b.c', refresh_token: 'r', company_id: 7 }],
])('%s 는 세션이 되지 않는다 — 스코프 경로를 만들 수 없다', (_label, response) => {
  // 스코프가 없으면 `{company_id}/{user_id}` 를 만들 수 없고 서버는 403 을 준다.
  expect(() => setTokens(response as Parameters<typeof setTokens>[0])).toThrow('Invalid OfficeWave')
  expect(getAuthSession()).toBeNull()
})

it('cancels a scoped request if the login changes before the interceptor attaches its token', async () => {
  setTokens(pair())
  const adapter = vi.fn()
  apiClient.defaults.adapter = adapter
  const request = selectDriveFiles({}, 'ko')
  setTokens(pair(8, 99))
  await expect(request).rejects.toMatchObject({ code: 'ERR_CANCELED' })
  expect(adapter).not.toHaveBeenCalled()
  expect(getAuthSession()?.access_token).toBe(pair(8, 99).access_token)
})

it('management settings use the company scope without a user segment', async () => {
  const tokens = pair()
  setTokens(tokens)
  const calls: { method?: string; url?: string; body: unknown }[] = []
  apiClient.defaults.adapter = async (config) => {
    calls.push({ method: config.method, url: config.url, body: JSON.parse(config.data ?? 'null') })
    expect(config.headers.get('Authorization')).toBe('Bearer ' + tokens.access_token)
    return {
      data: {},
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
    }
  }
  await updateUserSetting({ is_like_alarm: false }, 'ko')
  await updateCompanySetting({ latest_post_day: 7 }, 'ko')
  expect(calls).toEqual([
    {
      method: 'patch',
      url: '/board/companies/7/settings/users/me',
      body: { is_like_alarm: false },
    },
    { method: 'patch', url: '/board/companies/7/settings', body: { latest_post_day: 7 } },
  ])
})
