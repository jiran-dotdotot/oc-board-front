import { type BrowserContext, expect, test } from '@playwright/test'

// OfficeWave 자격증명 + Go 리소스 픽스처. 실계정·실서버 검증이 아니다.
// 로그인·재발급·로그아웃은 OfficeWave(`/api/v1/oauth/login`·`/refresh-token`·`/logout`),
// 게시판은 Go(`/api/v1/board/…`). 두 호스트 모두 `**/api/v1/**` 패턴에 걸린다.
const jwt = (revision: number) =>
  'header.' +
  Buffer.from(
    JSON.stringify({
      iss: 'http://officewave',
      sub: 'Authorization',
      scopes: ['ROLE_MEMBER'],
      company_id: 1,
      user_id: 1,
      exp: Math.floor(Date.now() / 1000) + 7200,
      revision,
    }),
  ).toString('base64url') +
  '.signature'
const tokenPair = (revision = 0) => ({
  token_type: 'Bearer',
  expired_in: 7200,
  access_token: jwt(revision),
  refresh_token: 'fixture-refresh-' + revision,
  company_id: 1,
  user_id: 1,
  scopes: ['ROLE_MEMBER'],
  agent_id: null,
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

async function mockWire(
  context: BrowserContext,
  options: { rejectLogin?: boolean; expired?: boolean; refreshStatus?: number } = {},
) {
  const initial = tokenPair(0)
  const rotated = tokenPair(1)
  let releaseExpired!: () => void
  const expiredBarrier = new Promise<void>((resolve) => {
    releaseExpired = resolve
  })
  let expiredRequests = 0
  const calls = {
    login: 0,
    refresh: 0,
    logout: 0,
    me: 0,
    refreshedMe: 0,
    credentials: null as unknown,
    agentIdSeen: [] as string[],
  }
  await context.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: { ...cors, 'access-control-allow-methods': 'GET, POST' },
      })
      return
    }
    // 브라우저 로그인은 `agent_id` 가 없으므로 쿼리 키 자체가 없어야 한다(생략 ≠ 빈값).
    if (url.searchParams.has('agent_id')) calls.agentIdSeen.push(path)
    const respond = (status: number, json: unknown) =>
      route.fulfill({ status, headers: cors, json })
    if (path === '/api/v1/oauth/login') {
      calls.login++
      calls.credentials = request.postDataJSON()
      expect(request.headers().authorization).toBeUndefined()
      await respond(
        options.rejectLogin ? 403 : 200,
        // Laravel 은 자격증명 불일치를 `abort(403)` + `{message}` 봉투로 준다.
        options.rejectLogin ? { message: '아이디 또는 비밀번호가 올바르지 않습니다.' } : initial,
      )
    } else if (path === '/api/v1/refresh-token') {
      calls.refresh++
      expect(request.postDataJSON()).toEqual({
        type: 'browser',
        authority: 'normal',
        refresh_token: initial.refresh_token,
      })
      // 419 = JWT 만료(재발급 불가) — 이때는 세션을 폐기하고 로그인으로 돌린다.
      await respond(options.refreshStatus ?? 200, options.refreshStatus ? {} : rotated)
    } else if (path === '/api/v1/logout') {
      calls.logout++
      expect(request.headers().authorization).toBe('Bearer ' + initial.access_token)
      await respond(200, { type: 'logout' })
    } else if (path === '/api/v1/board/me') {
      calls.me++
      const bearer = request.headers().authorization
      if (options.expired && bearer === 'Bearer ' + initial.access_token) {
        expiredRequests++
        // 두 탭 시나리오는 둘이 모두 401 을 만난 뒤에야 풀어 준다(단일 갱신 확인).
        if (expiredRequests >= (options.refreshStatus ? 1 : 2)) releaseExpired()
        await expiredBarrier
        // Go 는 만료도 401 로 준다(OfficeWave 의 419 와 다르다).
        await respond(401, { error: { code: 'UNAUTHORIZED', message: 'Expired' } })
      } else {
        expect(bearer).toBe(
          'Bearer ' + (options.expired ? rotated.access_token : initial.access_token),
        )
        if (options.expired) calls.refreshedMe++
        await respond(200, me)
      }
    } else {
      // 본 도메인 성공 경로는 go-main.spec.ts 가 본다. 여기는 인증만 격리한다.
      await respond(404, { error: { code: 'NOT_FOUND', message: 'Outside authentication scope' } })
    }
  })
  return { calls, initial, rotated }
}

test('OfficeWave login → me → logout clears the session without changing the screen design', async ({
  page,
  context,
}) => {
  const { calls } = await mockWire(context)
  await page.goto('/login')
  await page.locator('#login-email').fill(' go-user ')
  await page.locator('#login-password').fill(' password ')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/$/)
  await expect(
    page.getByRole('button').filter({ hasText: 'Go Tester', visible: true }),
  ).toBeVisible()
  expect(calls.credentials).toEqual({
    grant_type: 'password',
    type: 'browser',
    authority: 'normal',
    username: ' go-user ',
    password: ' password ',
  })
  expect(calls.login).toBe(1)
  expect(calls.me).toBeGreaterThan(0)
  expect(calls.agentIdSeen).toEqual([])
  await page.getByRole('button').filter({ hasText: 'Go Tester', visible: true }).click()
  await page.locator('a[href="/login"]').filter({ visible: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate((key) => localStorage.getItem(key), sessionKey)).toBeNull()
  await expect.poll(() => calls.logout).toBe(1)
})

test('unauthenticated deep link → /login?redirect= → login returns to the original URL', async ({
  page,
  context,
}) => {
  await mockWire(context)
  // 세션 없이 깊은 주소로 들어오면 원래 주소(경로+쿼리)를 redirect 에 싣고 로그인으로 간다
  await page.goto('/my?chip=draft&page=2')
  await expect(page).toHaveURL('/login?redirect=%2Fmy%3Fchip%3Ddraft%26page%3D2')
  await expect(page.locator('#login-email')).toBeVisible()

  await page.locator('#login-email').fill('go-user')
  await page.locator('#login-password').fill('fixture-password')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL('/my?chip=draft&page=2')
  expect(await page.evaluate((k) => localStorage.getItem(k) !== null, sessionKey)).toBe(true)
})

test('/login?redirect= only accepts same-origin paths', async ({ page, context }) => {
  await mockWire(context)
  await page.goto('/login?redirect=https%3A%2F%2Fevil.test%2Fx')
  await page.locator('#login-email').fill('go-user')
  await page.locator('#login-password').fill('fixture-password')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/$/)
})

test('login 403 stays on the form and does not trigger refresh', async ({ page, context }) => {
  const { calls } = await mockWire(context, { rejectLogin: true })
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

type Tab = import('@playwright/test').Page

// 두 탭 모두 실제 서비스를 쓴다 — 모듈 인스턴스는 각자, 저장소는 공유다.
const fetchMe = (target: Tab) =>
  target.evaluate(async () => {
    const { getMe } = await import('/src/services/userService.ts')
    return (await getMe('ko')).id
  })

const seed = (page: Tab, pair: ReturnType<typeof tokenPair>) =>
  page.evaluate(
    ({ key, pair }) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          id: 'same-session',
          access_token: pair.access_token,
          refresh_token: pair.refresh_token,
          company_id: pair.company_id,
          user_id: pair.user_id,
          agent_id: null,
        }),
      ),
    { key: sessionKey, pair },
  )

test('two tabs share native Web Locks and consume an expired session refresh once', async ({
  page,
  context,
}) => {
  const { calls, initial, rotated } = await mockWire(context, { expired: true })
  await page.goto('/login')
  await seed(page, initial)
  await page.reload()
  const second = await context.newPage()
  await second.goto('/login')
  const result = await Promise.all([fetchMe(page), fetchMe(second)])
  expect(result).toEqual([1, 1])
  expect(calls.refresh).toBe(1)
  expect(calls.refreshedMe).toBe(2)
  expect(calls.agentIdSeen).toEqual([])
  for (const tab of [page, second]) {
    const stored = await tab.evaluate((key) => JSON.parse(localStorage.getItem(key)!), sessionKey)
    expect(stored.id).toBe('same-session')
    expect(stored.refresh_token).toBe(rotated.refresh_token)
    await expect(tab).toHaveURL(/\/login$/)
  }
})

test('refresh rejected with 419 retires the session instead of retrying', async ({
  page,
  context,
}) => {
  const { calls, initial } = await mockWire(context, { expired: true, refreshStatus: 419 })
  await page.goto('/login')
  await seed(page, initial)
  await page.reload()
  await expect(fetchMe(page)).rejects.toThrow()
  expect(calls.refresh).toBe(1)
  expect(calls.refreshedMe).toBe(0)
  expect(await page.evaluate((key) => localStorage.getItem(key), sessionKey)).toBeNull()
})
