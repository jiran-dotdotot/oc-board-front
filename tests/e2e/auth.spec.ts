import { type BrowserContext, expect, test } from '@playwright/test'

// Go contract fixtures. These tests do not use real credentials or validate the running backend.
const jwt = (revision: number) =>
  'header.' +
  Buffer.from(
    JSON.stringify({
      iss: 'oc-api-go/board',
      sub: '1',
      company_id: 1,
      user_id: 1,
      exp: Math.floor(Date.now() / 1000) + 3600,
      revision,
    }),
  ).toString('base64url') +
  '.signature'
const tokenPair = (revision = 0) => ({
  token_type: 'Bearer',
  expires_in: 3600,
  access_token: jwt(revision),
  refresh_token: 'fixture-refresh-' + revision,
})
const me = {
  id: 1,
  company_id: 1,
  name: 'Go Tester',
  account: 'go-user',
  email: 'go@example.test',
  is_admin: false,
  is_category_admin: false,
  is_board_admin: false,
  member: null,
  company_setting: null,
  company_user_setting: null,
  profile_src: null,
}
const sessionKey = 'oc-board-go-session'
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Authorization, Content-Type, Lang, Time_zone',
}

async function mockGo(
  context: BrowserContext,
  options: { rejectLogin?: boolean; expired?: boolean } = {},
) {
  const initial = tokenPair(0)
  const rotated = tokenPair(1)
  let releaseExpired!: () => void
  const expiredBarrier = new Promise<void>((resolve) => {
    releaseExpired = resolve
  })
  let expiredRequests = 0
  const calls = { login: 0, refresh: 0, me: 0, refreshedMe: 0, credentials: null as unknown }
  await context.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: { ...cors, 'access-control-allow-methods': 'GET, POST' },
      })
      return
    }
    const respond = (status: number, json: unknown) =>
      route.fulfill({ status, headers: cors, json })
    if (path === '/api/v1/board/login') {
      calls.login++
      calls.credentials = request.postDataJSON()
      expect(request.headers().authorization).toBeUndefined()
      await respond(
        options.rejectLogin ? 401 : 200,
        options.rejectLogin
          ? { error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }
          : initial,
      )
    } else if (path === '/api/v1/board/refresh') {
      calls.refresh++
      expect(request.headers().authorization).toBeUndefined()
      expect(request.postDataJSON()).toEqual({ refresh_token: initial.refresh_token })
      await respond(200, rotated)
    } else if (path === '/api/v1/board/me') {
      calls.me++
      const bearer = request.headers().authorization
      if (options.expired && bearer === 'Bearer ' + initial.access_token) {
        expiredRequests++
        if (expiredRequests === 2) releaseExpired()
        await expiredBarrier
        await respond(401, { error: { code: 'UNAUTHORIZED', message: 'Expired' } })
      } else {
        expect(bearer).toBe(
          'Bearer ' + (options.expired ? rotated.access_token : initial.access_token),
        )
        if (options.expired) calls.refreshedMe++
        await respond(200, me)
      }
    } else {
      // Main domain success is checked in go-main.spec.ts; this fixture isolates authentication.
      await respond(404, { error: { code: 'NOT_FOUND', message: 'Outside authentication scope' } })
    }
  })
  return { calls, initial, rotated }
}

test('Go login → me → logout clears the session without changing the screen design', async ({
  page,
  context,
}) => {
  const { calls } = await mockGo(context)
  await page.goto('/login')
  await page.locator('#login-email').fill(' go-user ')
  await page.locator('#login-password').fill(' password ')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/$/)
  await expect(
    page.getByRole('button').filter({ hasText: 'Go Tester', visible: true }),
  ).toBeVisible()
  expect(calls.credentials).toEqual({ username: ' go-user ', password: ' password ' })
  expect(calls.login).toBe(1)
  expect(calls.me).toBeGreaterThan(0)
  await page.getByRole('button').filter({ hasText: 'Go Tester', visible: true }).click()
  await page.locator('a[href="/login"]').filter({ visible: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate((key) => localStorage.getItem(key), sessionKey)).toBeNull()
})

test('login 401 stays on the form and does not trigger refresh', async ({ page, context }) => {
  const { calls } = await mockGo(context, { rejectLogin: true })
  await page.goto('/login')
  await page.locator('#login-email').fill('bad-user')
  await page.locator('#login-password').fill('bad-password')
  await page.locator('button[type="submit"]').click()
  await expect(page.locator('p.bg-destructive-bg')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
  expect(calls.login).toBe(1)
  expect(calls.refresh).toBe(0)
  expect(await page.evaluate((key) => localStorage.getItem(key), sessionKey)).toBeNull()
})

test('two tabs share native Web Locks and consume an expired session refresh once', async ({
  page,
  context,
}) => {
  const { calls, initial, rotated } = await mockGo(context, { expired: true })
  await page.goto('/login')
  await page.evaluate(
    ({ key, pair }) => localStorage.setItem(key, JSON.stringify({ id: 'same-session', ...pair })),
    { key: sessionKey, pair: initial },
  )
  await page.reload()
  const second = await context.newPage()
  await second.goto('/login')
  // Both tabs run the real service; each has its own JS module instance and shared storage.
  const fetchMe = async (target: typeof page) =>
    target.evaluate(async () => {
      const { getMe } = await import('/src/services/userService.ts')
      return (await getMe('ko')).id
    })
  const result = await Promise.all([fetchMe(page), fetchMe(second)])
  expect(result).toEqual([1, 1])
  expect(calls.refresh).toBe(1)
  expect(calls.refreshedMe).toBe(2)
  for (const tab of [page, second]) {
    const stored = await tab.evaluate((key) => JSON.parse(localStorage.getItem(key)!), sessionKey)
    expect(stored.id).toBe('same-session')
    expect(stored.refresh_token).toBe(rotated.refresh_token)
    await expect(tab).toHaveURL(/\/login$/)
  }
})
