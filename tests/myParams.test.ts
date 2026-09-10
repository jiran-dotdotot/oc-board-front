import {
  CHIP_ORDER,
  type ChipKey,
  MY_TABS,
  type MyTab,
  buildMyListParams,
  hasTabs,
  resolveTab,
} from '@/components/mypage/myParams'
import { describe, expect, it } from 'vitest'

const every = (fn: (chip: ChipKey, tab: MyTab) => void) => {
  for (const chip of CHIP_ORDER) for (const tab of MY_TABS) fn(chip, tab)
}

describe('내 활동 칩·탭 → Go 요청 매핑', () => {
  it('칩 × 탭이 맞는 엔드포인트로 간다', () => {
    const path = (chip: ChipKey, tab: MyTab) => buildMyListParams(chip, tab, 1, 10).path
    expect(path('important', 'post')).toBe('/posts/bookmarks')
    expect(path('important', 'file')).toBe('/drive-files/bookmarks')
    expect(path('my', 'post')).toBe('/posts/mine')
    expect(path('my', 'file')).toBe('/drive-files/mine')
    expect(path('trash', 'post')).toBe('/posts/mine')
    expect(path('trash', 'file')).toBe('/drive-files/mine')
    // 임시저장·예약은 게시글에만 있는 상태다 — 자료 탭이 와도 게시글 경로로 간다
    expect(path('draft', 'file')).toBe('/posts/mine')
    expect(path('schedule', 'file')).toBe('/posts/mine')
  })

  it('state 는 칩별로 정확하고, 북마크 분기에는 아예 없다', () => {
    const params = (chip: ChipKey, tab: MyTab) =>
      buildMyListParams(chip, tab, 1, 10).params as Record<string, unknown>
    expect(params('my', 'post').state).toBe('ACT')
    expect(params('draft', 'post').state).toBe('SAVE')
    expect(params('schedule', 'post').state).toBe('SCHEDULED')
    expect(params('trash', 'post').state).toBe('DEL')
    expect(params('my', 'file').state).toBe('ACT')
    expect(params('trash', 'file').state).toBe('DEL')
    // 전용 북마크 경로에는 state 가 선언조차 되어 있지 않다(05:405-411)
    expect(params('important', 'post')).not.toHaveProperty('state')
    expect(params('important', 'file')).not.toHaveProperty('state')
  })

  it('mine 분기는 state 를 «항상» 보낸다 — 생략하면 200 빈 페이지다', () => {
    every((chip, tab) => {
      const plan = buildMyListParams(chip, tab, 1, 10)
      if (plan.path.endsWith('/mine')) {
        expect((plan.params as { state?: string }).state, `${chip}/${tab}`).toBeTruthy()
      }
    })
  })

  it('is_bookmark 를 어떤 조합에서도 만들지 않는다', () => {
    // 문자열 truthiness 라 "false"·"0" 이 서로 반대로 먹고, /drive-files/mine 에 0 만 붙이면 400이다.
    every((chip, tab) => {
      expect(
        Object.keys(buildMyListParams(chip, tab, 3, 20).params),
        `${chip}/${tab}`,
      ).not.toContain('is_bookmark')
    })
  })

  it('sort 키를 만들지 않는다 — 생략해야 서버가 state 별 기본 정렬을 고른다', () => {
    every((chip, tab) => {
      const keys = Object.keys(buildMyListParams(chip, tab, 1, 10).params)
      expect(
        keys.filter((k) => k.startsWith('sort')),
        `${chip}/${tab}`,
      ).toEqual([])
      expect(keys.sort()).toEqual(
        chip === 'important' ? ['page', 'take'] : ['page', 'state', 'take'],
      )
    })
  })

  it('take·page 를 그대로 전달한다', () => {
    expect(buildMyListParams('my', 'post', 4, 30).params).toMatchObject({ take: 30, page: 4 })
    expect(buildMyListParams('important', 'file', 2, 50).params).toEqual({ take: 50, page: 2 })
  })

  it('하위탭은 두 도메인이 다 있는 칩에만 붙고, 나머지는 게시글로 고정된다', () => {
    expect(CHIP_ORDER.filter(hasTabs)).toEqual(['important', 'my', 'trash'])
    expect(resolveTab('my', 'file')).toBe('file')
    expect(resolveTab('trash', 'file')).toBe('file')
    // 탭이 없는 칩은 URL 에 ?kind=file 이 적혀 있어도 게시글이다
    expect(resolveTab('draft', 'file')).toBe('post')
    expect(resolveTab('schedule', 'file')).toBe('post')
    expect(resolveTab('important', undefined)).toBe('post')
  })
})
