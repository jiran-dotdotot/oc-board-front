import { type BrowserContext, type Page, type Request, expect, test } from '@playwright/test'

/**
 * 글쓰기 /write — Go wire fixture 만 쓴다(실행 중인 백엔드·실제 자격증명 없음).
 * 나모 에디터 iframe 은 같은 postMessage 프로토콜을 구현한 스텁 HTML 로 바꿔 끼운다
 * (`saveEditor` 요청에 `<script>` 가 섞인 HTML 을 돌려줘 저장 전 살균까지 검증한다).
 */
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

const C1 = 'c1111111-1111-4111-8111-111111111111'
const B1 = 'b1111111-1111-4111-8111-111111111111'
const B2 = 'b2222222-2222-4222-8222-222222222222'
const D1 = 'd1111111-1111-4111-8111-111111111111'
const P1 = 'a1111111-1111-4111-8111-111111111111'
const UTC = '2026-09-01T00:00:00.000000Z'

const board = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  company_id: 7,
  category_id: C1,
  user_id: 42,
  type: 'BOARD',
  title,
  description: '',
  position: 1,
  is_active: true,
  read_permission: 'ALL',
  write_permission: 'ALL',
  is_post_alarm: true,
  is_notice_alarm: true,
  size_limit: null,
  size_limit_per_file: null,
  except_extension: [],
  created_at: UTC,
  updated_at: UTC,
  deleted_at: null,
  is_writable: true,
  is_board_admin: false,
  is_category_admin: false,
  can_manage: false,
  is_bookmark: false,
  is_public: false,
  is_drive: false,
  is_admin: false,
  is_board_member_post_alarm: true,
  is_board_member_notice_alarm: true,
  is_board_member_comment_alarm: true,
  ...extra,
})

const tree = () => ({
  public_boards: [],
  categories: [
    {
      id: C1,
      company_id: 7,
      parent_category_id: null,
      name: '경영지원',
      depth: 1,
      position: 1,
      is_active: true,
      is_admin: false,
      is_post_alarm: true,
      is_comment_alarm: true,
      boards: [
        board(B1, '자유게시판', { can_manage: true, is_admin: true }),
        board(B2, '읽기전용', { is_writable: false }),
        board(D1, '자료실', { type: 'DRIVE', is_drive: true }),
      ],
      child_categories: [],
    },
  ],
})

/** 작성/수정 응답 — 관계 없음(06:90). */
const writeResult = (state: string, over: Record<string, unknown> = {}) => ({
  id: P1,
  company_id: 7,
  category_id: C1,
  board_id: B1,
  user_id: 42,
  seq: 1,
  state,
  title: '연동 테스트',
  content: '<p>본문</p>',
  text_content: '본문',
  is_allow_comment: true,
  is_comment_alarm: true,
  is_send_alarm: false,
  is_notice_alarm: false,
  posted_at: state === 'ACT' ? UTC : null,
  schedule_at: null,
  schedule_at_tz: null,
  created_at: UTC,
  updated_at: UTC,
  delete_user_id: null,
  deleted_at: null,
  purged_at: null,
  is_writable: true,
  is_view: true,
  is_bookmark: false,
  is_like: false,
  comment_count: 0,
  view_count: 0,
  like_count: 0,
  ...over,
})

const detail = (state: string) => ({
  ...writeResult(state),
  board: board(B1, '자유게시판', { can_manage: true, is_admin: true }),
  badges: [],
  files: [],
  thumbnail: null,
  user: { id: 42, name: '김준석', profile_image_id: null, profile_src: null },
  is_mine: true,
  is_admin: true,
  comments: [],
  likes: [],
  row_num: null,
  prev_post_id: null,
  next_post_id: null,
  delete_user: null,
})

/** 나모 에디터 스텁 — 레거시 프로토콜(onInitCompleted / saveEditor / setNamoEditorBody) 그대로. */
const editorStub = `<!doctype html><html><head><meta charset="utf-8"></head><body><p id="body">stub</p><script>
  window.addEventListener('message', (e) => {
    if (e.data === 'saveEditor' || e.data === 'getBody')
      parent.postMessage({ title: e.data === 'getBody' ? 'getNamoEditorBody' : 'saveEditor',
        value: '<p>본문</p><script>alert(1)</' + 'script><img src=x onerror="alert(2)">' }, '*')
    if (e.data && e.data.title === 'setNamoEditorBody') document.getElementById('body').textContent = e.data.value
  })
  parent.postMessage({ title: 'onInitCompleted' }, '*')
</script></body></html>`

interface Wire {
  method: string
  path: string
  body: unknown
}

async function setup(page: Page, context: BrowserContext) {
  await context.addInitScript(() => localStorage.setItem('oc-board-lang', 'ko'))
  const wires: Wire[] = []
  const errors: string[] = []
  let saved: Record<string, unknown> = detail('SAVE')
  page.on('pageerror', (e) => errors.push(e.message))
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'Authorization, Content-Type, Lang, Time_zone',
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE',
  }
  const bodyOf = (request: Request) => {
    try {
      return request.postDataJSON()
    } catch {
      return null
    }
  }
  await context.route('https://namo-editor.jupiterstudio.co.kr/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: editorStub }),
  )
  await context.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const body = bodyOf(request)
    wires.push({ method: request.method(), path, body })
    const ok = (json: unknown, status = 200) => route.fulfill({ status, headers: cors, json })
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
    if (request.method() === 'POST' && path === `${scope}/boards/${B1}/posts`) {
      saved = { ...detail(body.state), ...body }
      return ok(writeResult(body.state, { title: body.title, content: body.content }), 201)
    }
    if (request.method() === 'PUT' && path === `${scope}/posts/${P1}`) {
      saved = { ...saved, ...body }
      return ok(writeResult(body.state ?? 'SAVE', { title: body.title, content: body.content }))
    }
    switch (path) {
      case '/api/v1/board/me':
        return ok({
          id: 42,
          company_id: 7,
          name: '김준석',
          account: 'go-user',
          email: 'go@example.test',
          is_admin: false,
          is_category_admin: false,
          is_board_admin: true,
          member: null,
          company_setting: null,
          company_user_setting: null,
          profile_src: null,
        })
      case `${scope}/categories`:
        return ok(tree())
      case `${scope}/posts/${P1}`:
        return ok(saved)
      case `${scope}/boards/${B1}`:
        return ok({
          ...board(B1, '자유게시판', { can_manage: true }),
          board_admins: [],
          board_members: [],
          board_departments: [],
          total_usage_size: 0,
        })
      default:
        return ok({ data: [], current_page: 1, last_page: 1, per_page: 10, total: 0 })
    }
  })

  await page.goto('/login')
  await page.locator('#login-email').fill('go-user')
  await page.locator('#login-password').fill('fixture-password')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/$/)
  return { wires, errors }
}

const pickBoard = async (page: Page) => {
  await page.getByRole('button', { name: '게시판을 선택해주세요.' }).click()
  await page.getByRole('button', { name: '경영지원 › 자유게시판' }).click()
}

test('임시저장 → POST SAVE → ?postId → 등록 → PUT ACT(살균된 본문) → 상세 이동', async ({
  page,
  context,
}) => {
  const { wires, errors } = await setup(page, context)
  await page.goto('/write')

  // 쓸 수 없는 게시판·자료실은 후보에 없다
  await page.getByRole('button', { name: '게시판을 선택해주세요.' }).click()
  await expect(page.getByRole('button', { name: '읽기전용' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /자료실/ })).toHaveCount(0)
  await page.getByRole('button', { name: '경영지원 › 자유게시판' }).click()
  await page.getByPlaceholder('제목을 입력해주세요.').fill('연동 테스트')

  await page.getByRole('button', { name: '임시저장' }).click()
  await expect(page).toHaveURL(new RegExp(`/write\\?postId=${P1}`))
  await expect(page.getByText('임시 저장되었습니다.')).toBeVisible()
  const created = wires.find((w) => w.method === 'POST' && w.path.endsWith('/posts'))!
  const cb = created.body as Record<string, unknown>
  expect(cb.state).toBe('SAVE')
  expect(cb.title).toBe('연동 테스트')
  // 살균: 에디터 스텁이 준 <script>·onerror 가 요청 본문에 없다(서버는 살균하지 않는다, 06:39)
  expect(String(cb.content)).toContain('<p>본문</p>')
  expect(String(cb.content)).not.toContain('script')
  expect(String(cb.content)).not.toContain('onerror')
  // 계약 밖 키를 보내지 않는다 — files 는 무시되는 키다(06:224)
  expect(cb).not.toHaveProperty('files')
  expect(cb).not.toHaveProperty('badges') // 공지 OFF

  // 공지 ON(can_manage 게시판) 후 등록 → PUT 재사용
  await page.getByRole('switch', { name: '이 글을 공지로 등록' }).click()
  await page.getByRole('button', { name: '등록', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/post/${P1}$`))
  const updated = wires.find((w) => w.method === 'PUT' && w.path.endsWith(`/posts/${P1}`))!
  const ub = updated.body as Record<string, unknown>
  expect(ub.state).toBe('ACT')
  expect(Array.isArray(ub.badges) && ub.badges.length).toBe(1)
  expect((ub.badges as { end_date: string }[])[0].end_date).toMatch(/^2999-12-31T23:59:59/)
  expect(ub).not.toHaveProperty('board_id') // 게시판 그대로 → 안 보낸다
  expect(wires.filter((w) => w.method === 'POST' && w.path.endsWith('/posts'))).toHaveLength(1)
  await expect(page.getByText('게시글이 등록되었습니다.')).toBeVisible()
  expect(errors).toEqual([])
})

test('예약 발행 — 과거 시각은 인라인 에러, 요청 0건', async ({ page, context }) => {
  await page.clock.install({ time: new Date('2026-09-10T14:00:00') })
  const { wires } = await setup(page, context)
  await page.goto('/write')
  await pickBoard(page)
  await page.getByPlaceholder('제목을 입력해주세요.').fill('예약')
  await page.getByRole('radio', { name: '예약 발행' }).click()
  // 기본값 = now+1h(15:05). 달력에서 오늘 09:00 칩 → 과거
  await page.getByRole('button', { name: /2026\.09\.10 15:05/ }).click()
  await page.getByRole('button', { name: '09:00' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '등록', exact: true }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: '현재 이후 시각을 선택해주세요.' }),
  ).toBeVisible()
  expect(wires.filter((w) => w.method !== 'GET')).toEqual(
    wires.filter((w) => w.path === '/api/v1/oauth/login'),
  )
})

test('작성 중 취소 → 이탈 확인 → 나가기', async ({ page, context }) => {
  await setup(page, context)
  await page.goto('/write')
  await pickBoard(page)
  await page.getByPlaceholder('제목을 입력해주세요.').fill('버리는 글')
  await page.getByRole('button', { name: '취소' }).click()
  const dialog = page.getByRole('alertdialog', { name: '작성을 취소하시겠습니까?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '계속 작성' }).click()
  await expect(page).toHaveURL(/\/write$/)
  await page.getByRole('button', { name: '취소' }).click()
  await dialog.getByRole('button', { name: '나가기' }).click()
  await expect(page).toHaveURL(new RegExp(`/board/${B1}`))
})
