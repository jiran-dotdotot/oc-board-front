import { expect, test } from '@playwright/test'

// Go wire fixtures only; no real credentials or running-backend verification.
const scope = '/api/v1/board/companies/7/users/42'
const timestamp = '2026-09-08T08:00:00.000000Z'
const boardId = '11111111-1111-4111-8111-111111111111'
const categoryId = '22222222-2222-4222-8222-222222222222'
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
const board = {
  id: boardId,
  company_id: 7,
  category_id: categoryId,
  user_id: 42,
  type: 'BOARD',
  title: 'Go bookmarked board',
  description: '',
  position: 0,
  is_active: true,
  read_permission: 'ALL',
  write_permission: 'ALL',
  is_post_alarm: true,
  is_notice_alarm: true,
  size_limit: null,
  size_limit_per_file: null,
  except_extension: [],
  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: null,
  is_writable: true,
  is_board_admin: false,
  is_category_admin: false,
  can_manage: false,
  is_bookmark: true,
  is_public: false,
  is_drive: false,
  is_admin: false,
  is_board_member_post_alarm: true,
  is_board_member_notice_alarm: true,
  is_board_member_comment_alarm: true,
}
const author = {
  id: 42,
  name: 'Go author',
  profile_image_id: null,
  disabled_at: null,
  deleted_at: null,
  profile_src: null,
}
const posts = [false, true, null].map((active, index) => {
  const id = '33333333-3333-4333-8333-33333333333' + index
  return {
    id,
    seq: index + 1,
    category_id: categoryId,
    board_id: boardId,
    user_id: 42,
    state: 'ACT',
    title: active === null ? null : active ? 'Active Go notice' : 'Expired Go notice',
    text_content: '',
    comment_count: 0,
    view_count: 3,
    like_count: 1,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    posted_at: timestamp,
    schedule_at: null,
    schedule_at_tz: null,
    delete_user_id: null,
    delete_user: null,
    is_writable: true,
    is_view: true,
    is_bookmark: false,
    is_like: false,
    board: active === null ? { ...board, title: 'Null-safe board' } : board,
    badges:
      active === null
        ? []
        : [
            {
              id: '44444444-4444-4444-8444-44444444444' + index,
              company_id: 7,
              board_id: boardId,
              post_id: id,
              type: 'NOTICE',
              start_date: '2026-09-01T00:00:00.000000Z',
              end_date: active ? '2999-12-31T00:00:00.000000Z' : timestamp,
              created_at: timestamp,
              updated_at: timestamp,
              deleted_at: null,
              is_active: active,
            },
          ],
    files: [],
    user: active === null ? { ...author, name: null } : author,
    thumbnail: null,
  }
})
const file = {
  id: '55555555-5555-4555-8555-555555555555',
  company_id: 7,
  category_id: null,
  board_id: '66666666-6666-4666-8666-666666666666',
  drive_folder_id: null,
  user_id: 42,
  state: 'ACT',
  origin_file_name: 'Go attachment.pdf',
  extension: 'pdf',
  size: 1024,
  delete_user_id: null,
  upload_expire_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: null,
  is_bookmark: false,
  user: { ...author, name: 'Go uploader' },
  delete_user: null,
  board: { id: '66666666-6666-4666-8666-666666666666', title: 'Go drive' },
}
const pageEnvelope = (data: unknown[], perPage: number) => ({
  data,
  current_page: 1,
  last_page: 1,
  per_page: perPage,
  total: data.length,
})

for (const isAdmin of [true, false]) {
  test(
    'Go login loads main data for ' + (isAdmin ? 'company admin' : 'regular user'),
    async ({ page, context }) => {
      await context.addInitScript(() => localStorage.setItem('oc-board-lang', 'ko'))
      const requests: {
        path: string
        method: string
        query: URLSearchParams
        headers: Record<string, string>
      }[] = []
      const unexpected: string[] = []
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await context.route('**/api/v1/**', async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        const cors = {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': 'Authorization, Content-Type, Lang, Time_zone',
          'access-control-allow-methods': 'GET, POST',
        }
        if (request.method() === 'OPTIONS') {
          await route.fulfill({ status: 204, headers: cors })
          return
        }
        requests.push({
          path: url.pathname,
          method: request.method(),
          query: url.searchParams,
          headers: request.headers(),
        })
        let json: unknown
        switch (url.pathname) {
          case '/api/v1/oauth/login':
            json = {
              token_type: 'Bearer',
              expired_in: 7200,
              access_token: token,
              refresh_token: 'fixture-refresh',
              company_id: 7,
              user_id: 42,
              scopes: ['ROLE_MEMBER'],
              agent_id: null,
            }
            break
          case '/api/v1/board/me':
            json = {
              id: 42,
              company_id: 7,
              name: 'Go user',
              account: 'go-user',
              email: 'go@example.test',
              is_admin: isAdmin,
              is_category_admin: false,
              is_board_admin: false,
              member: null,
              company_setting: null,
              company_user_setting: null,
              profile_src: null,
            }
            break
          case scope + '/bookmarks':
            json = pageEnvelope([{ ...board, board_id: boardId }], 100)
            break
          case scope + '/posts':
            json = pageEnvelope(posts, 8)
            break
          case scope + '/posts/mine':
            // 홈 「해야 할 일」 칩 카운트 — take=1 의 total 만 쓴다(SAVE 3건 · SCHEDULED 1건)
            json = {
              ...pageEnvelope([], 1),
              total: url.searchParams.get('state') === 'SAVE' ? 3 : 1,
            }
            break
          case scope + '/drive-files':
            json = pageEnvelope([file], 8)
            break
          case scope + (isAdmin ? '/categories/admin' : '/categories'):
            json = {
              public_boards: [],
              categories: [
                {
                  id: categoryId,
                  company_id: 7,
                  user_id: 42,
                  parent_category_id: null,
                  depth: 1,
                  name: 'Go category',
                  position: 0,
                  is_active: true,
                  created_at: timestamp,
                  updated_at: timestamp,
                  deleted_at: null,
                  is_admin: false,
                  is_post_alarm: true,
                  is_comment_alarm: true,
                  boards: [board],
                  child_categories: [],
                },
              ],
            }
            break
          default:
            unexpected.push(url.pathname)
            await route.fulfill({
              status: 404,
              headers: cors,
              json: { error: { code: 'NOT_FOUND' } },
            })
            return
        }
        await route.fulfill({ status: 200, headers: cors, json })
      })

      await page.goto('/login')
      await page.locator('#login-email').fill('go-user')
      await page.locator('#login-password').fill('fixture-password')
      await page.locator('button[type="submit"]').click()
      await expect(page).toHaveURL(/\/$/)
      const active = page.getByRole('button', { name: 'Active Go notice', exact: true })
      const inactive = page.getByRole('button', { name: 'Expired Go notice', exact: true })
      await expect(active).toBeVisible()
      await expect(active.getByText('공지', { exact: true })).toBeVisible()
      await expect(inactive).toBeVisible()
      await expect(inactive.getByText('공지', { exact: true })).toHaveCount(0)
      await expect(active.getByText('Go author', { exact: true })).toBeVisible()
      await expect(
        active.getByText(board.title, { exact: true }).filter({ visible: true }),
      ).toBeVisible()
      await expect(page.getByRole('button').filter({ hasText: 'Null-safe board' })).toBeVisible()
      const fileRow = page.getByRole('button').filter({ hasText: 'Go attachment.pdf' })
      await expect(fileRow).toBeVisible()
      await expect(
        fileRow.getByText('Go drive', { exact: true }).filter({ visible: true }),
      ).toBeVisible()
      await expect(
        fileRow.getByText('Go uploader', { exact: true }).filter({ visible: true }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Go category' }).filter({ visible: true }),
      ).toBeVisible()
      await expect(
        page.locator('a[href="/board/' + boardId + '"]').filter({ visible: true }),
      ).toHaveCount(2)

      await expect(page.getByRole('button', { name: /임시저장\s*3/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /예약 발행\s*1/ })).toBeVisible()

      const mainRequests = requests.filter((request) => request.path.startsWith(scope))
      expect(new Set(mainRequests.map((request) => request.path))).toEqual(
        new Set([
          scope + '/bookmarks',
          scope + '/posts',
          scope + '/posts/mine',
          scope + '/drive-files',
          scope + (isAdmin ? '/categories/admin' : '/categories'),
        ]),
      )
      for (const request of mainRequests) {
        expect(request.method).toBe('GET')
        expect(request.headers.authorization).toBe('Bearer ' + token)
        expect(request.headers.lang).toBe('ko')
        if (request.path.endsWith('/bookmarks')) {
          expect(request.query.get('take')).toBe('100')
          expect(request.query.has('is_bookmark')).toBe(false)
        } else if (request.path.endsWith('/posts/mine')) {
          expect(['SAVE', 'SCHEDULED']).toContain(request.query.get('state'))
          expect(request.query.get('take')).toBe('1')
        } else if (request.path.endsWith('/posts')) {
          expect(request.query.get('is_not_paging')).not.toBe('1')
          expect(request.query.get('sort[by]')).toBe('posted_at')
        } else if (request.path.endsWith('/drive-files')) {
          expect(request.query.has('is_not_paging')).toBe(false)
          expect(request.query.get('take')).toBe('8')
          expect(request.query.get('sort[by]')).toBe('created_at')
        } else if (!isAdmin) {
          expect(request.query.get('with_category_admin')).toBe('1')
        }
      }
      expect(unexpected).toEqual([])
      expect(errors).toEqual([])
    },
  )
}
