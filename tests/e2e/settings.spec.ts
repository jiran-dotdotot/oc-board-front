import { type BrowserContext, type Page, type Request, expect, test } from '@playwright/test'

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

const C1 = 'c1111111-1111-4111-8111-111111111111'
const F1 = 'f1111111-1111-4111-8111-111111111111'
const B1 = 'b1111111-1111-4111-8111-111111111111'
const B2 = 'b2222222-2222-4222-8222-222222222222'
const D1 = 'd1111111-1111-4111-8111-111111111111'
const PB = 'e1111111-1111-4111-8111-111111111111'

/** BoardView. `can_manage` 는 저장 권한, `is_category_admin` 은 «삭제» 권한이다(더 좁다). */
const board = (
  id: string,
  title: string,
  position: number,
  extra: Record<string, unknown> = {},
) => ({
  id,
  company_id: 7,
  category_id: null,
  title,
  description: '',
  type: 'BOARD',
  is_active: true,
  is_drive: false,
  is_public: false,
  position,
  read_permission: 'ALL',
  write_permission: 'ALL',
  can_manage: true,
  is_category_admin: false,
  is_post_alarm: true,
  is_notice_alarm: true,
  size_limit: null,
  size_limit_per_file: null,
  except_extension: [],
  ...extra,
})

const drive = board(D1, '개발 자료실', 1, {
  type: 'DRIVE',
  is_drive: true,
  size_limit: 5 * 1024 * 1024 * 1024,
  size_limit_per_file: 500 * 1024 * 1024,
  except_extension: ['EXE'],
})

const category = (
  id: string,
  name: string,
  position: number,
  extra: Record<string, unknown> = {},
) => ({
  id,
  company_id: 7,
  parent_category_id: null,
  name,
  depth: 1,
  position,
  is_active: true,
  is_admin: false,
  is_post_alarm: true,
  is_comment_alarm: true,
  boards: [],
  child_categories: [],
  ...extra,
})

/** 쓰기 결과를 실제로 반영한다 — 저장 후 재조회에서 값이 되돌아오면 «변경 없음» 판정이 깨진다. */
const saved = new Map<string, Record<string, unknown>>()
/** 개인 알림·회사 설정. PATCH 가 보낸 키만 덮어쓴다(생략 키는 유지 — legacy.Bool 계약). */
const userSetting = () => ({
  company_id: 7,
  user_id: 42,
  is_post_alarm: true,
  is_notice_alarm: true,
  is_public_post_alarm: true,
  is_comment_alarm: true,
  is_like_alarm: true,
  recent_search_keyword: [],
  created_at: '2026-09-01T00:00:00.000000Z',
  updated_at: '2026-09-01T00:00:00.000000Z',
  deleted_at: null,
})
const companySetting = () => ({
  id: 'a1111111-1111-4111-8111-111111111111',
  company_id: 7,
  latest_post_day: 30,
  latest_post_type: 'BOARD',
  created_at: '2026-09-01T00:00:00.000000Z',
  updated_at: '2026-09-01T00:00:00.000000Z',
  deleted_at: null,
})
const apply = (b: ReturnType<typeof board>) => ({ ...b, ...(saved.get(b.id) ?? {}) })

/** 조직도 — 루트 1개 + 부서 2개(정본 응답 모양: members=직속, total_members=자신+하위). */
const orgMember = (userId: number, deptId: number, name: string) => ({
  id: userId,
  company_id: 7,
  department_id: deptId,
  user_id: userId,
  rank_id: null,
  role_id: null,
  position: 0,
  leader: false,
  user: {
    id: userId,
    name,
    profile_image_id: null,
    disabled_at: null,
    deleted_at: null,
    profile_src: null,
  },
  rank: null,
  role: null,
  department: null,
})
const jiwoo = orgMember(21, 3, '김지우')
const seojun = orgMember(9, 4, '박서준')
const orgTree = {
  id: 1,
  parent_id: null,
  name: '테스트 회사',
  breadcrumbs: '{1}',
  member_count: 2,
  is_category_department: true,
  members: [],
  total_members: [jiwoo, seojun],
  departments: [
    {
      id: 3,
      parent_id: 1,
      name: '경영지원팀',
      breadcrumbs: '{1,3}',
      member_count: 1,
      is_category_department: true,
      members: [jiwoo],
      total_members: [jiwoo],
      departments: [],
    },
    {
      id: 4,
      parent_id: 1,
      name: '개발팀',
      breadcrumbs: '{1,4}',
      member_count: 1,
      is_category_department: true,
      members: [seojun],
      total_members: [seojun],
      departments: [],
    },
  ],
}

const treeOf = () => ({
  public_boards: [apply(board(PB, '전사 공지', 1))],
  categories: [
    category(C1, '경영지원', 1, {
      boards: [apply(board(B1, '자유게시판', 1)), apply(board(B2, '건의사항', 2))],
      child_categories: [
        {
          ...category(F1, '개발팀', 1),
          parent_category_id: C1,
          depth: 2,
          boards: [apply(drive)],
        },
      ],
    }),
  ],
})

const boardDetail = (id: string) => ({
  ...apply(id === D1 ? drive : board(id, '자유게시판', 1)),
  board_admins: [{ user_id: 9, user: { id: 9, name: '박서준', profile_src: null } }],
  board_members: [],
  board_departments: [{ department_id: 3, department: { id: 3, name: '경영지원팀' } }],
  total_usage_size: id === D1 ? 2 * 1024 * 1024 * 1024 : 0,
})

interface Wire {
  method: string
  path: string
  body: unknown
}

/** 로그인 → 홈까지 태우고 트리 API 를 목킹한다. `admin` 이면 회사 관리자 응답. */
async function setup(page: Page, context: BrowserContext, admin: boolean) {
  saved.clear()
  let user = userSetting()
  let company = companySetting()
  await context.addInitScript(() => localStorage.setItem('oc-board-lang', 'ko'))
  const wires: Wire[] = []
  const errors: string[] = []
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
  await context.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors })
      return
    }
    const path = url.pathname
    wires.push({ method: request.method(), path, body: bodyOf(request) })
    const ok = (json: unknown, status = 200) => route.fulfill({ status, headers: cors, json })
    if (path === '/api/v1/oauth/login') {
      await ok({
        token_type: 'Bearer',
        expired_in: 7200,
        access_token: token,
        refresh_token: 'fixture-refresh',
        company_id: 7,
        user_id: 42,
        scopes: ['ROLE_MEMBER'],
        agent_id: null,
      })
      return
    }
    if (request.method() !== 'GET') {
      // 관리 도메인은 company 스코프까지만이다 — `/users/{id}` 세그먼트가 없다.
      if (path === '/api/v1/board/companies/7/settings/users/me') {
        user = { ...user, ...bodyOf(request) }
        await ok(user)
        return
      }
      if (path === '/api/v1/board/companies/7/settings') {
        company = { ...company, ...bodyOf(request) }
        await ok(company)
        return
      }
      // 삭제는 204(본문 없음), 나머지 쓰기는 200 이다.
      if (request.method() === 'DELETE') {
        await route.fulfill({ status: 204, headers: cors })
        return
      }
      if (path.endsWith('/category-tree')) {
        const patch = (bodyOf(request)?.update_board_position ?? {}) as Record<string, number>
        for (const [id, position] of Object.entries(patch))
          saved.set(id, { ...saved.get(id), position })
        await ok({ reordered: { categories: 0, boards: Object.keys(patch).length } })
        return
      }
      const id = path.split('/').pop()!
      if (path.startsWith(scope + '/boards/'))
        saved.set(id, { ...saved.get(id), ...bodyOf(request) })
      await ok({})
      return
    }
    switch (path) {
      case '/api/v1/board/me':
        return ok({
          id: 42,
          company_id: 7,
          name: '김준석',
          account: 'go-user',
          email: 'go@example.test',
          is_admin: admin,
          is_category_admin: false,
          is_board_admin: !admin,
          member: null,
          company_setting: company,
          company_user_setting: user,
          profile_src: null,
        })
      case scope + '/categories':
      case scope + '/categories/admin':
        return ok(treeOf())
      // `/categories/management` 는 봉투가 아니라 **직접 배열**이고 공용 게시판이 없다.
      case scope + '/categories/management':
        return ok(treeOf().categories)
      case '/api/v1/board/companies/7/departments':
        return ok(orgTree)
      case scope + '/bookmarks':
        return ok({ data: [], current_page: 1, last_page: 1, per_page: 100, total: 0 })
      default:
        if (path.startsWith(scope + '/boards/')) return ok(boardDetail(path.split('/').pop()!))
        if (path.startsWith(scope + '/categories/'))
          return ok({
            id: C1,
            company_id: 7,
            parent_category_id: null,
            name: '경영지원',
            depth: 1,
            position: 1,
            is_active: true,
            is_admin: false,
            can_manage: true,
            category_admins: [],
            category_members: [],
            category_departments: [{ department_id: 3, department: { id: 3, name: '경영지원팀' } }],
          })
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

const lastWire = (wires: Wire[], method: string, suffix: string) =>
  [...wires].reverse().find((w) => w.method === method && w.path.endsWith(suffix))
const pollWire = (wires: Wire[], method: string, suffix: string) =>
  expect.poll(() => lastWire(wires, method, suffix)?.body ?? null)

test('회사 관리자 — 탭이 URL 에 실리고, 트리·저장·정렬·삭제가 Go 계약대로 나간다', async ({
  page,
  context,
}) => {
  const { wires, errors } = await setup(page, context, true)

  // ① 탭 상태의 정본은 URL 이다 — 새로고침해도 살아 있다
  await page.goto('/settings')
  expect(new URL(page.url()).searchParams.has('tab')).toBe(false)
  await page.getByRole('tab', { name: '게시판 관리' }).click()
  await expect(page).toHaveURL(/tab=content/)
  await page.reload()
  await expect(page.getByRole('tab', { name: '게시판 관리' })).toHaveAttribute(
    'aria-selected',
    'true',
  )

  // ② 트리가 실데이터로 렌더된다. 「공용」은 회사 관리자에게만 보이는 고정 노드다
  const treeEl = page.getByRole('tree')
  await expect(treeEl.getByRole('treeitem', { name: /공용/ })).toBeVisible()
  await expect(treeEl.getByRole('treeitem', { name: /전사 공지/ })).toBeVisible()
  // 깊이는 들여쓰기(시각)만이 아니라 aria-level 로도 전달된다
  await expect(treeEl.getByRole('treeitem', { name: '경영지원' })).toHaveAttribute(
    'aria-level',
    '1',
  )
  await expect(treeEl.getByRole('treeitem', { name: '개발팀' })).toHaveAttribute('aria-level', '2')
  await expect(treeEl.getByRole('treeitem', { name: '개발 자료실' })).toHaveAttribute(
    'aria-level',
    '3',
  )

  // ③ 상세 저장은 **바뀐 필드만** 보낸다 — 추가 키는 400, non-DRIVE 의 용량 키는 422 다
  await treeEl.getByRole('treeitem', { name: '자유게시판' }).click()
  const name = page.getByRole('textbox', { name: '명' })
  await expect(name).toHaveValue('자유게시판')
  await name.fill('자유게시판 (개편)')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await pollWire(wires, 'PUT', '/boards/' + B1).toEqual({ title: '자유게시판 (개편)' })

  // ④ 변경이 없으면 아무것도 보내지 않는다
  const before = wires.length
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByText('변경된 내용이 없습니다.')).toBeVisible()
  expect(wires.slice(before).some((w) => w.method === 'PUT')).toBe(false)

  // ⑤ 정렬 — 키보드(Alt+↓)도 드래그와 같은 경로로 `PUT category-tree` 에 **바뀐 항목만**
  const row = treeEl.getByRole('treeitem', { name: '자유게시판' })
  await row.focus()
  await page.keyboard.press('Alt+ArrowDown')
  await pollWire(wires, 'PUT', '/category-tree').toEqual({
    update_board_position: { [B1]: 2, [B2]: 1 },
  })

  // ⑥ 삭제는 영향 범위를 알린 뒤 204 로 나간다
  await treeEl.getByRole('treeitem', { name: '건의사항' }).click()
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('복원할 수 없습니다')
  await dialog.getByRole('button', { name: '삭제' }).click()
  // DELETE 는 본문이 없다 — 요청 자체가 갔는지로 확인한다
  await expect.poll(() => !!lastWire(wires, 'DELETE', '/boards/' + B2)).toBe(true)

  // ⑦ 자료실은 용량 칩 + 현재 사용량. 정본 칩에 없는 값도 칩으로 남는다
  await treeEl.getByRole('treeitem', { name: '개발 자료실' }).click()
  await expect(page.getByRole('button', { name: '500MB' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(/현재 사용량 2/)).toBeVisible()

  // ⑧ 공개 범위 — 조직 지정으로 바꾸고 피커에서 부서를 고르면 등급과 grant 가 함께 나간다
  await treeEl.getByRole('treeitem', { name: '자유게시판' }).click()
  await page.getByRole('radio', { name: '조직 지정' }).click()
  await page.getByRole('button', { name: /조직도에서 선택/ }).click()
  const picker = page.getByRole('dialog')
  await expect(picker.getByText('공개 범위 선택')).toBeVisible()
  // 루트는 펼쳐진 채로 뜬다 — 한 줄만 보이면 무엇을 고르는 화면인지 알 수 없다.
  await picker.getByRole('treeitem', { name: /개발팀/ }).click()
  // 기존 grant(경영지원팀 1명)에 개발팀 1명이 더해진다.
  await expect(picker.getByText('총 2명')).toBeVisible()
  await picker.getByRole('button', { name: '확인' }).click()
  await pollWire(wires, 'PUT', '/boards/' + B1).toEqual({
    insert_board_department_id: [4],
    read_permission: 'MEMBER',
  })

  // ⑨ 관리자 추가 — 부서를 체크하면 소속 구성원이 사용자 id 로 실린다(부서 grant 가 없다)
  await page.getByRole('button', { name: '관리자 추가' }).click()
  const admPicker = page.getByRole('dialog')
  await expect(admPicker.getByText('관리자 지정')).toBeVisible()
  await admPicker.getByRole('treeitem', { name: /경영지원팀/ }).click()
  await admPicker.getByRole('button', { name: '확인' }).click()
  // 기존 관리자(9)는 그대로 두고 새로 고른 21 만 추가된다.
  await pollWire(wires, 'PUT', '/boards/' + B1).toEqual({ insert_board_admin_user_id: [21] })

  // ⑩ 카테고리를 전체 공개로 되돌리면 grant 삭제 전파를 먼저 알린다
  await treeEl.getByRole('treeitem', { name: '경영지원' }).click()
  await page.getByRole('radio', { name: '전체 공개' }).click()
  const scopeDialog = page.getByRole('alertdialog')
  await expect(scopeDialog).toContainText('하위 폴더와 그 안의 게시판에도 함께 적용됩니다')
  await scopeDialog.getByRole('button', { name: '확인' }).click()
  await pollWire(wires, 'PUT', '/categories/' + C1).toEqual({
    delete_category_department_id: [3],
  })

  expect(errors).toEqual([])
})

test('게시판 관리자 — 부분 트리에 공용이 없고 삭제 버튼도 없다. 개인 알림은 저장된다', async ({
  page,
  context,
}) => {
  const { wires, errors } = await setup(page, context, false)
  await page.goto('/settings?tab=content')

  const treeEl = page.getByRole('tree')
  await expect(treeEl.getByRole('treeitem', { name: '자유게시판' })).toBeVisible()
  // `/categories/management` 를 쓰고 `/categories/admin` 은 부르지 않는다
  expect(wires.some((w) => w.path.endsWith('/categories/management'))).toBe(true)
  expect(wires.some((w) => w.path.endsWith('/categories/admin'))).toBe(false)
  await expect(treeEl.getByRole('treeitem', { name: /공용/ })).toHaveCount(0)

  // 저장은 되지만(can_manage) 삭제는 회사·카테고리 관리자만이다(04-board.md:524)
  await treeEl.getByRole('treeitem', { name: '자유게시판' }).click()
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '삭제', exact: true })).toHaveCount(0)

  // 메인화면 탭은 회사 관리자 전용이라 노출되지 않는다
  await expect(page.getByRole('tab', { name: '메인화면' })).toHaveCount(0)

  // 일반 탭 — 개인 알림은 «본인» 설정이라 게시판 관리자가 아니어도 저장된다.
  // 보낸 키 하나만 실려 나가고(나머지 4종은 유지) 스위치가 즉시 뒤집힌다.
  await page.getByRole('tab', { name: '일반' }).click()
  const comment = page.getByRole('switch', { name: '댓글 알림' })
  await expect(comment).toHaveAttribute('aria-checked', 'true')
  await comment.click()
  await expect(comment).toHaveAttribute('aria-checked', 'false')
  await expect
    .poll(() => lastWire(wires, 'PATCH', '/api/v1/board/companies/7/settings/users/me')?.body)
    .toEqual({ is_comment_alarm: false })

  expect(errors).toEqual([])
})

test('메인화면 — 회사 관리자만 기간을 바꿀 수 있고, 저장은 고른 값 하나만 보낸다', async ({
  page,
  context,
}) => {
  const { wires, errors } = await setup(page, context, true)
  await page.goto('/settings?tab=main')

  const save = page.getByRole('button', { name: '저장', exact: true })
  // 고른 값이 저장값과 같으면 보낼 것이 없다.
  await expect(save).toBeDisabled()
  await page.getByRole('radio', { name: '7일' }).click()
  await expect(page.getByRole('radio', { name: '7일' })).toHaveAttribute('aria-checked', 'true')
  await expect(save).toBeEnabled()
  await save.click()

  await pollWire(wires, 'PATCH', '/api/v1/board/companies/7/settings').toEqual({
    latest_post_day: 7,
  })
  // 저장 뒤에는 서버 값과 같아져 다시 비활성이다(같은 값을 두 번 보내지 않는다).
  await expect(save).toBeDisabled()
  await expect(page.getByText('저장되었습니다.')).toBeVisible()
  expect(errors).toEqual([])
})

test('추가 모달 — 조직 지정은 대상이 있어야 저장되고, 고른 대상이 생성 요청에 실린다', async ({
  page,
  context,
}) => {
  const { wires, errors } = await setup(page, context, true)
  await page.goto('/settings?tab=content')

  await page.getByRole('button', { name: '추가', exact: true }).click()
  await page.getByRole('button', { name: '게시판', exact: true }).click()
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()
  await modal.getByRole('textbox').first().fill('신규 게시판')

  // 조직 지정인데 대상이 비면 저장을 막는다(정본은 공개 범위가 필수 `*`).
  await modal.getByRole('radio', { name: '조직 지정' }).click()
  await modal.getByRole('button', { name: '추가', exact: true }).click()
  await expect(modal.getByText('공개 범위를 선택해주세요.')).toBeVisible()
  expect(lastWire(wires, 'POST', '/boards')).toBeUndefined()

  // 부서를 고르면 등급·grant 가 함께 실린다. 위치 기본값은 첫 카테고리(경영지원)다.
  await modal.getByRole('treeitem', { name: /개발팀/ }).click()
  await modal.getByRole('button', { name: '추가', exact: true }).click()
  await pollWire(wires, 'POST', '/boards').toEqual({
    type: 'BOARD',
    title: '신규 게시판',
    category_id: C1,
    is_post_alarm: true,
    is_active: true,
    read_permission: 'MEMBER',
    insert_board_department_id: [4],
  })
  expect(errors).toEqual([])
})
