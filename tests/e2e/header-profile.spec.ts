import { expect, test } from '@playwright/test'

// Go wire fixtures only — 실행 중인 백엔드나 실제 자격증명을 쓰지 않는다.
const scope = '/api/v1/board/companies/7/users/42'
const token =
  'header.' +
  Buffer.from(
    JSON.stringify({
      iss: 'http://officewave',
      sub: 'Authorization',
      scopes: ['ROLE_MEMBER'],
      company_id: 7,
      user_id: 42,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString('base64url') +
  '.signature'
const SESSION_KEY = 'oc-board-go-session'

/** 로그인 → 홈. 헤더 프로필만 보는 테스트라 목록 API 는 전부 빈 응답이면 된다. */
async function setup(
  page: import('@playwright/test').Page,
  context: import('@playwright/test').BrowserContext,
) {
  await context.addInitScript(() => localStorage.setItem('oc-board-lang', 'ko'))
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'Authorization, Content-Type, Lang, Time_zone',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE',
  }
  await context.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors })
      return
    }
    const ok = (json: unknown) => route.fulfill({ status: 200, headers: cors, json })
    if (path === '/api/v1/oauth/login')
      return ok({
        token_type: 'Bearer',
        expired_in: 7200,
        access_token: token,
        refresh_token: 'fixture-refresh',
        company_id: 7,
        user_id: 42,
        scopes: ['ROLE_MEMBER'],
        agent_id: null,
      })
    if (path === '/api/v1/board/me')
      return ok({
        id: 42,
        company_id: 7,
        name: '김준석',
        account: 'go-user',
        email: 'go@example.test',
        is_admin: true,
        is_category_admin: false,
        is_board_admin: false,
        member: null,
        company_setting: null,
        company_user_setting: null,
        profile_src: null,
      })
    if (path === scope + '/categories') return ok({ public_boards: [], categories: [] })
    return ok({ data: [], current_page: 1, last_page: 1, per_page: 10, total: 0 })
  })
  await page.goto('/login')
  await page.locator('#login-email').fill('go-user')
  await page.locator('#login-password').fill('fixture-password')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/$/)
  return { errors }
}

test('헤더 프로필 메뉴 — 내 활동 이동 · ESC/바깥 클릭 닫기 · 언어 전환 · 로그아웃', async ({
  page,
  context,
}) => {
  const { errors } = await setup(page, context)
  const trigger = page.getByRole('banner').getByRole('button', { expanded: false }).last()
  const menu = page.getByRole('menu')

  // ① 「내 활동」은 실제로 이동한다 — 이전 구현은 핸들러 없는 <button> 이라 무동작이었다
  await trigger.click()
  await expect(menu).toBeVisible()
  await menu.getByRole('menuitem', { name: '내 활동' }).click()
  await expect(page).toHaveURL(/\/my$/)
  await expect(menu).toHaveCount(0)

  // ② 바깥 클릭으로 닫힌다
  await trigger.click()
  await expect(menu).toBeVisible()
  // 오버레이가 포인터를 먹는 것이 «정상»이다(그 아래 요소가 눌리지 않는다) → 좌표로 누른다
  await page.mouse.click(20, 400)
  await expect(menu).toHaveCount(0)

  // ③ ESC 로 닫히고 포커스가 트리거로 돌아온다(키보드만으로 빠져나올 수 있어야 한다)
  await trigger.click()
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()

  // ④ 언어 전환 — 선택 상태가 aria-checked 로도 전달된다(색 단독 금지)
  await trigger.click()
  await expect(menu.getByRole('menuitemradio', { name: '한국어' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await menu.getByRole('menuitemradio', { name: 'English' }).click()
  await expect(menu).toHaveCount(0)
  await expect(page.getByRole('banner').getByPlaceholder('Search posts & files')).toBeVisible()
  await trigger.click()
  await expect(menu.getByRole('menuitemradio', { name: 'English' })).toHaveAttribute(
    'aria-checked',
    'true',
  )

  // ⑤ 로그아웃 — /login 으로 나가고 세션이 지워진다
  await menu.getByRole('menuitem', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate((k) => localStorage.getItem(k), SESSION_KEY)).toBeNull()

  expect(errors).toEqual([])
})
