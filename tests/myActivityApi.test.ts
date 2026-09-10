import { apiClient } from '@/lib/apiClient'
import { clearTokens, setTokens } from '@/lib/authStorage'
import {
  purgeDriveFiles,
  restoreDriveFiles,
  selectBookmarkedDriveFiles,
  selectMyDriveFiles,
} from '@/services/driveService'
import {
  deletePosts,
  purgePosts,
  restorePosts,
  selectBookmarkedPosts,
  selectMyPosts,
} from '@/services/postService'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
const SCOPE = '/api/v1/board/companies/7/users/42'

beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
  setTokens(pair())
})
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  clearTokens()
  vi.unstubAllGlobals()
})

const envelope = { data: [], current_page: 1, last_page: 1, per_page: 20, total: 0 }

/** 실제로 나가는 URL(쿼리 포함)과 body 를 잡는다. */
function capture(payload: unknown) {
  const seen: { url: string; method: string; body: unknown }[] = []
  apiClient.defaults.adapter = async (config) => {
    const u = new URL(apiClient.getUri(config), 'http://fixture.test')
    seen.push({
      url: u.pathname + u.search,
      method: config.method!,
      body: config.data ? JSON.parse(config.data as string) : undefined,
    })
    return { data: payload, status: 200, statusText: 'OK', headers: {}, config }
  }
  return seen
}

describe('내 활동 목록 요청', () => {
  it('/posts/mine 은 state 를 보내고 is_bookmark·sort 를 붙이지 않는다', async () => {
    const seen = capture(envelope)
    await selectMyPosts({ state: 'DEL', take: 10, page: 2 }, 'ko')
    const url = seen[0].url
    expect(url.startsWith(`${SCOPE}/posts/mine`)).toBe(true)
    expect(url).toContain('state=DEL')
    expect(url).toContain('take=10')
    expect(url).toContain('page=2')
    expect(url).not.toContain('is_bookmark')
    expect(url).not.toContain('sort')
  })

  it('/drive-files/mine 도 state 만 보낸다 — is_bookmark=0 만 보내면 서버가 400 이다', async () => {
    const seen = capture(envelope)
    await selectMyDriveFiles({ state: 'ACT' }, 'ko')
    expect(seen[0].url).toContain('state=ACT')
    expect(seen[0].url).not.toContain('is_bookmark')
    // take·page 기본값
    expect(seen[0].url).toContain('take=20')
    expect(seen[0].url).toContain('page=1')
  })

  it('북마크는 전용 경로로만 가고 state 를 보내지 않는다', async () => {
    const seen = capture(envelope)
    await selectBookmarkedPosts({ page: 3 }, 'ko')
    await selectBookmarkedDriveFiles({ take: 5 }, 'ko')
    expect(seen[0].url.startsWith(`${SCOPE}/posts/bookmarks`)).toBe(true)
    expect(seen[1].url.startsWith(`${SCOPE}/drive-files/bookmarks`)).toBe(true)
    for (const s of seen) {
      expect(s.url).not.toContain('state=')
      expect(s.url).not.toContain('is_bookmark')
    }
  })
})

describe('내 활동 일괄 쓰기', () => {
  it('게시글 삭제·영구삭제·복원이 각자 경로로 ids body 를 보낸다', async () => {
    const seen = capture({ affected: 2, ignored_ids: ['x'] })
    const ids = ['a', 'b']
    expect(await deletePosts(ids)).toEqual({ affected: 2, ignored_ids: ['x'] })
    await purgePosts(ids)
    await restorePosts(ids)
    expect(seen.map((s) => [s.method, s.url])).toEqual([
      ['delete', `${SCOPE}/posts`],
      ['delete', `${SCOPE}/posts/purge`],
      ['post', `${SCOPE}/posts/restore`],
    ])
    // 게시글 일괄 body 는 추가 키를 400 으로 거절한다 — ids 하나만 담는다(06:336)
    for (const s of seen) expect(s.body).toEqual({ ids })
  })

  it('자료 복원은 6필드 응답을 그대로 채워 준다 (누락은 0/[] 로 보정)', async () => {
    capture({ affected: 1, success_count: 1, fail_drive: ['board-1'], fail_count: 2 })
    expect(await restoreDriveFiles(['f1'])).toEqual({
      affected: 1,
      ignored_ids: [],
      success_drive: [],
      success_count: 1,
      // ⚠ 파일 ID 가 아니라 «게시판» ID 다(09:182)
      fail_drive: ['board-1'],
      fail_count: 2,
    })
  })

  it('자료 영구삭제는 2필드 응답이다', async () => {
    const seen = capture({})
    expect(await purgeDriveFiles(['f1'])).toEqual({ affected: 0, ignored_ids: [] })
    expect(seen[0].url).toBe(`${SCOPE}/drive-files/purge`)
    expect(seen[0].method).toBe('delete')
  })
})
