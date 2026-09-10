import { expect, test } from '@playwright/test'

// Go wire fixtures only — 실행 중인 백엔드나 실제 자격증명을 쓰지 않는다.
const scope = '/api/v1/board/companies/7/users/42'
const timestamp = '2026-09-08T08:00:00.000000Z'
const boardId = '11111111-1111-4111-8111-111111111111'
const KEYWORD = '워크샵'
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

const author = {
  id: 42,
  name: '이서연',
  profile_image_id: null,
  disabled_at: null,
  deleted_at: null,
  profile_src: null,
}
const post = {
  id: '33333333-3333-4333-8333-333333333330',
  seq: 1,
  category_id: null,
  board_id: boardId,
  user_id: 42,
  state: 'ACT',
  title: `하반기 전사 ${KEYWORD} 일정 안내`,
  text_content: `이번 ${KEYWORD}은 9월 둘째 주 제주에서 진행됩니다.`,
  comment_count: 5,
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
  board: { id: boardId, title: '자유게시판' },
  badges: [],
  files: [],
  user: author,
  thumbnail: null,
}
const file = {
  id: '55555555-5555-4555-8555-555555555555',
  company_id: 7,
  category_id: null,
  board_id: '66666666-6666-4666-8666-666666666666',
  drive_folder_id: null,
  user_id: 42,
  state: 'ACT',
  origin_file_name: `전사 ${KEYWORD} 단체사진.png`,
  extension: 'png',
  size: 5347737,
  delete_user_id: null,
  upload_expire_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: null,
  is_bookmark: false,
  user: { ...author, name: '정다은' },
  delete_user: null,
  board: { id: '66666666-6666-4666-8666-666666666666', title: '팀 자료실' },
}

const envelope = (data: unknown[], perPage: number, total = data.length) => ({
  data,
  current_page: 1,
  last_page: Math.max(1, Math.ceil(total / perPage)),
  per_page: perPage,
  total,
})

interface Recorded {
  path: string
  query: URLSearchParams
}

/** 로그인 → 홈까지 태우고, 검색 두 목록을 목킹한다. `empty` 면 두 목록 모두 0건. */
async function setup(
  page: import('@playwright/test').Page,
  context: import('@playwright/test').BrowserContext,
  empty = false,
) {
  await context.addInitScript(() => localStorage.setItem('oc-board-lang', 'ko'))
  const requests: Recorded[] = []
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
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
    requests.push({ path: url.pathname, query: url.searchParams })
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
          name: '김준석',
          account: 'go-user',
          email: 'go@example.test',
          is_admin: false,
          is_category_admin: false,
          is_board_admin: false,
          member: null,
          company_setting: null,
          // 서버가 자동 누적한 최근 검색어 — 로컬이 비었을 때 시드로 보인다.
          company_user_setting: { recent_search_keyword: ['보안 정책'] },
          profile_src: null,
        }
        break
      case scope + '/posts':
        json = empty ? envelope([], 10, 0) : envelope([post], 10, 1)
        break
      case scope + '/drive-files':
        json = empty ? envelope([], 10, 0) : envelope([file], 10, 1)
        break
      case scope + '/bookmarks':
        json = envelope([], 100, 0)
        break
      case scope + '/categories':
        json = { public_boards: [], categories: [] }
        break
      default:
        await route.fulfill({ status: 200, headers: cors, json: envelope([], 10, 0) })
        return
    }
    await route.fulfill({ status: 200, headers: cors, json })
  })

  await page.goto('/login')
  await page.locator('#login-email').fill('go-user')
  await page.locator('#login-password').fill('fixture-password')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/$/)
  return { requests, errors }
}

const qs = (page: import('@playwright/test').Page) => new URL(page.url()).searchParams
const last = (requests: Recorded[], suffix: string) =>
  [...requests].reverse().find((r) => r.path.endsWith(suffix))!
/** 요청은 UI 조작보다 늦게 도착한다 — 마지막 요청의 쿼리 값이 기대치가 될 때까지 기다린다. */
const pollQuery = (requests: Recorded[], suffix: string, key: string) =>
  expect.poll(() => last(requests, suffix).query.get(key))

test('헤더 검색 → 탭·필터·정렬이 URL 에 반영되고 Go 파라미터가 탭마다 갈린다', async ({
  page,
  context,
}) => {
  const { requests, errors } = await setup(page, context)

  // ① 헤더에서 Enter → /search?q=
  const header = page.getByRole('banner')
  await header.getByPlaceholder('게시글·자료 통합 검색').fill(KEYWORD)
  await header.getByPlaceholder('게시글·자료 통합 검색').press('Enter')
  await expect(page).toHaveURL(/\/search/)
  expect(qs(page).get('q')).toBe(KEYWORD)

  // ② 결과 렌더 + 키워드 하이라이트(<mark>)
  const row = page.getByRole('button').filter({ hasText: '하반기 전사' })
  await expect(row).toBeVisible()
  await expect(row.locator('mark').first()).toHaveText(KEYWORD)
  await expect(page.getByRole('tab', { name: /게시글/ })).toHaveAttribute('aria-selected', 'true')

  // ③ 검색 대상 미지정이면 두 목록 모두 search 로 간다. 자료 목록에는 최근검색어
  //    서버 저장 스위치·비페이징을 보내지 않는다.
  await pollQuery(requests, '/posts', 'search').toBe(KEYWORD)
  const posts1 = last(requests, '/posts')
  expect(posts1.query.has('title')).toBe(false)
  expect(posts1.query.get('sort[by]')).toBe('relative')
  expect(posts1.query.get('sort[value]')).toBe(KEYWORD)
  await pollQuery(requests, '/drive-files', 'search').toBe(KEYWORD)
  const files1 = last(requests, '/drive-files')
  expect(files1.query.has('is_only_file_search')).toBe(false)
  expect(files1.query.has('is_not_paging')).toBe(false)

  // ④ 탭 전환이 URL 에 실린다
  await page.getByRole('tab', { name: /자료/ }).click()
  await expect(page).toHaveURL(/tab=files/)
  await expect(page.getByRole('tabpanel')).toContainText('단체사진')

  // ⑤ 상세 필터: 「적용」 을 눌러야 반영된다
  // 정본: 필터 토글은 검색바 «안»의 아이콘 버튼이다(접근 이름 「상세 검색」)
  await page.getByRole('main').getByRole('button', { name: '상세 검색', exact: true }).click()
  await expect(page).toHaveURL(/filter=1/)
  await page.getByRole('button', { name: '제목·파일명' }).click()
  expect(qs(page).has('target')).toBe(false) // 아직 초안
  await page.getByRole('button', { name: '적용' }).click()
  await expect(page).toHaveURL(/target=title/)
  expect(qs(page).get('tab')).toBe('files')

  // 대상이 제목이면 자료는 title(파일명만) 로 간다 — search 는 빠진다
  await pollQuery(requests, '/drive-files', 'title').toBe(KEYWORD)
  expect(last(requests, '/drive-files').query.has('search')).toBe(false)

  // ⑥ 정렬 → 탭마다 다른 컬럼
  await page.getByRole('button', { name: '관련도순' }).click()
  await page.getByRole('button', { name: '최신순' }).click()
  await expect(page).toHaveURL(/order=new/)
  await pollQuery(requests, '/drive-files', 'sort[by]').toBe('created_at')

  // ⑦ 새로고침해도 URL 로 상태가 복원된다
  await page.reload()
  expect(qs(page).get('q')).toBe(KEYWORD)
  await expect(page.getByRole('tab', { name: /자료/ })).toHaveAttribute('aria-selected', 'true')
  await pollQuery(requests, '/posts', 'title').toBe(KEYWORD)

  expect(errors).toEqual([])
})

test('2자 미만은 검색하지 않고, 0건이면 정본 안내가 뜬다', async ({ page, context }) => {
  const { requests, errors } = await setup(page, context, true)

  // ① 1자는 이동도 요청도 없다 — Go 는 search 1자를 «필터 없는 전체 목록» 으로 준다
  const input = page.getByRole('banner').getByPlaceholder('게시글·자료 통합 검색')
  await input.fill('가')
  await input.press('Enter')
  await expect(page).toHaveURL(/\/$/)
  expect(
    requests.some((r) => ['search', 'title', 'content'].some((k) => r.query.get(k) === '가')),
  ).toBe(false)

  // ② 0건 화면은 두 줄(정본 화면 06)
  await page.goto(`/search?q=${encodeURIComponent(KEYWORD)}`)
  await expect(page.getByText('검색 결과가 없습니다.')).toBeVisible()
  await expect(page.getByText('다른 검색어로 다시 시도해보세요.')).toBeVisible()
  await expect(page.getByRole('tab', { name: '게시글 0' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '자료 0' })).toBeVisible()

  expect(errors).toEqual([])
})
