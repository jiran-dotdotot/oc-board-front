import {
  activeFilterCount,
  buildFileParams,
  buildPostParams,
  draftOf,
  isQueryReady,
  parseSearchQuery,
  presetOf,
  rangeOf,
} from '@/components/search/searchParams'
import { addRecent } from '@/utils/recentSearch'
import { describe, expect, it } from 'vitest'

const TODAY = new Date(2026, 7, 19) // 2026-08-19 (로컬 기준)

describe('parseSearchQuery — 기본값은 URL에서 생략된다', () => {
  it('알 수 없는 값은 기본값으로 떨어진다', () => {
    expect(parseSearchQuery({})).toEqual({
      q: undefined,
      tab: undefined,
      target: undefined,
      board: undefined,
      cat: undefined,
      writer: undefined,
      from: undefined,
      to: undefined,
      comment: undefined,
      filter: undefined,
      order: undefined,
      page: undefined,
    })
    const junk = parseSearchQuery({
      tab: 'posts', // 기본값 → 생략
      target: 'title_content', // 우리 계약에 없는 값
      order: 'relative', // 기본값 → 생략
      page: '1',
      from: '2026/08/01', // 형식 불일치
      cat: 'yes',
    })
    expect(junk.tab).toBeUndefined()
    expect(junk.target).toBeUndefined()
    expect(junk.order).toBeUndefined()
    expect(junk.page).toBeUndefined()
    expect(junk.from).toBeUndefined()
    expect(junk.cat).toBeUndefined()
  })

  it('실제 값은 살린다', () => {
    const s = parseSearchQuery({
      q: '워크샵',
      tab: 'files',
      target: 'content',
      board: 'b1',
      cat: '1',
      writer: ' 이서연 ',
      from: '2026-05-12',
      to: '2026-08-12',
      comment: '1',
      filter: '1',
      order: 'new',
      page: '3',
    })
    expect(s).toEqual({
      q: '워크샵',
      tab: 'files',
      target: 'content',
      board: 'b1',
      cat: 1,
      writer: '이서연',
      from: '2026-05-12',
      to: '2026-08-12',
      comment: 1,
      filter: 1,
      order: 'new',
      page: 3,
    })
  })
})

describe('2자 미만 차단 — Go 는 탭마다 다르게 처리한다', () => {
  it('1자·공백은 검색하지 않는다', () => {
    expect(isQueryReady(undefined)).toBe(false)
    expect(isQueryReady('')).toBe(false)
    expect(isQueryReady(' 가 ')).toBe(false)
    expect(isQueryReady('가나')).toBe(true)
  })
})

describe('기간 프리셋 ↔ from/to', () => {
  it('프리셋을 날짜로 펴고 다시 역산한다', () => {
    expect(rangeOf('all', TODAY)).toEqual({})
    expect(rangeOf('custom', TODAY)).toEqual({})
    expect(rangeOf('1w', TODAY)).toEqual({ from: '2026-08-12', to: '2026-08-19' })
    expect(rangeOf('1m', TODAY)).toEqual({ from: '2026-07-19', to: '2026-08-19' })
    for (const p of ['1w', '1m', '3m', '6m'] as const) {
      const r = rangeOf(p, TODAY)
      expect(presetOf(r.from, r.to, TODAY)).toBe(p)
    }
  })

  it('어느 프리셋과도 안 맞으면 직접입력, 값이 없으면 전체', () => {
    expect(presetOf(undefined, undefined, TODAY)).toBe('all')
    expect(presetOf('2026-08-01', undefined, TODAY)).toBe('all')
    expect(presetOf('2026-05-12', '2026-08-12', TODAY)).toBe('custom')
  })
})

describe('buildPostParams', () => {
  it('검색 대상 미지정 = search (제목·평문·작성자 OR)', () => {
    const p = buildPostParams({ q: ' 워크샵 ' }, 10, 1)
    expect(p.search).toBe('워크샵')
    expect(p.title).toBeUndefined()
    expect(p.content).toBeUndefined()
    expect(p.sort).toEqual({ by: 'relative', order: 'desc', value: '워크샵' })
  })

  it('제목·본문은 각 파라미터로 가고 search 는 빠진다', () => {
    expect(buildPostParams({ q: '워크샵', target: 'title' }, 10, 1)).toMatchObject({
      title: '워크샵',
      search: undefined,
      content: undefined,
    })
    expect(buildPostParams({ q: '워크샵', target: 'content' }, 10, 1)).toMatchObject({
      content: '워크샵',
      search: undefined,
      title: undefined,
    })
  })

  it('is_include_comment 는 검색 대상이 지정됐을 때만 보낸다(Go 는 search 에 적용하지 않는다)', () => {
    expect(buildPostParams({ q: '워크샵', comment: 1 }, 10, 1).is_include_comment).toBeUndefined()
    expect(
      buildPostParams({ q: '워크샵', target: 'title', comment: 1 }, 10, 1).is_include_comment,
    ).toBe(true)
  })

  it('게시판·카테고리·공용 범위가 서로 배타적이다', () => {
    const noScope = buildPostParams({ q: 'ab', board: 'all' }, 10, 1)
    expect('board_id' in noScope).toBe(false)
    expect('category_id' in noScope).toBe(false)
    expect('is_public_only' in noScope).toBe(false)
    expect(buildPostParams({ q: 'ab', board: 'public' }, 10, 1).is_public_only).toBe(true)
    const cat = buildPostParams({ q: 'ab', board: 'c1', cat: 1 }, 10, 1)
    expect(cat.category_id).toBe('c1')
    expect('board_id' in cat).toBe(false)
    const board = buildPostParams({ q: 'ab', board: 'b1' }, 10, 1)
    expect(board.board_id).toBe('b1')
    expect('category_id' in board).toBe(false)
  })

  it('종료일에 23:59:59 를 붙인다 — 날짜만 보내면 그날이 통째로 빠진다', () => {
    const p = buildPostParams({ q: 'ab', from: '2026-05-12', to: '2026-08-12' }, 10, 1)
    expect(p.start_posted_at).toBe('2026-05-12 00:00:00')
    expect(p.end_posted_at).toBe('2026-08-12 23:59:59')
  })

  it('최신순은 posted_at 정렬이다', () => {
    expect(buildPostParams({ q: 'ab', order: 'new' }, 10, 2).sort).toEqual({
      by: 'posted_at',
      order: 'desc',
    })
  })
})

describe('buildFileParams', () => {
  it('본문 검색은 파일에 해당이 없어 조회하지 않는다', () => {
    expect(buildFileParams({ q: '워크샵', target: 'content' }, 10, 1)).toBeNull()
  })

  it('미지정은 search(파일명·업로더), 제목 지정은 title(파일명만)', () => {
    expect(buildFileParams({ q: '워크샵' }, 10, 1)).toMatchObject({
      search: '워크샵',
      title: undefined,
    })
    expect(buildFileParams({ q: '워크샵', target: 'title' }, 10, 1)).toMatchObject({
      title: '워크샵',
      search: undefined,
    })
  })

  it('최근검색어 서버 저장 스위치와 비페이징을 보내지 않는다', () => {
    const p = buildFileParams({ q: '워크샵' }, 10, 1)!
    expect('is_only_file_search' in p).toBe(false)
    expect('is_not_paging' in p).toBe(false)
  })

  it('자료 최신순은 created_at 이다(posted_at 이 아니다)', () => {
    expect(buildFileParams({ q: 'ab', order: 'new' }, 10, 1)!.sort).toEqual({
      by: 'created_at',
      order: 'desc',
    })
  })

  it('게시글과 파일 파라미터는 서로 다른 객체다 — sort 오염이 없어야 한다', () => {
    const s = { q: 'ab', order: 'new' } as const
    const post = buildPostParams(s, 10, 1)
    const file = buildFileParams(s, 10, 1)!
    expect(post.sort).not.toBe(file.sort)
    expect(post.sort?.by).toBe('posted_at')
    expect(file.sort?.by).toBe('created_at')
  })
})

describe('activeFilterCount · draftOf', () => {
  it('적용된 조건만 센다', () => {
    expect(activeFilterCount({ q: 'ab' })).toBe(0)
    expect(activeFilterCount({ q: 'ab', board: 'all' })).toBe(0)
    expect(activeFilterCount({ q: 'ab', from: '2026-08-01' })).toBe(0) // 반쪽 기간은 안 센다
    expect(
      activeFilterCount({
        q: 'ab',
        target: 'title',
        board: 'b1',
        writer: '이서연',
        from: '2026-08-01',
        to: '2026-08-19',
        comment: 1,
      }),
    ).toBe(5)
  })

  it('draftOf({}) 는 7키를 전부 undefined 로 만든다(적용 시 지우기용)', () => {
    expect(Object.keys(draftOf({})).sort()).toEqual(
      ['board', 'cat', 'comment', 'from', 'target', 'to', 'writer'].sort(),
    )
    expect(Object.values(draftOf({})).every((v) => v === undefined)).toBe(true)
  })
})

describe('최근 검색어 목록 규칙', () => {
  it('중복은 맨 위로, 상한은 8개', () => {
    expect(addRecent(['a', 'b'], 'b')).toEqual(['b', 'a'])
    expect(addRecent(['a'], '  ')).toEqual(['a'])
    const full = ['1', '2', '3', '4', '5', '6', '7', '8']
    expect(addRecent(full, '9')).toEqual(['9', '1', '2', '3', '4', '5', '6', '7'])
    expect(addRecent(full, '  x  ')).toEqual(['x', '1', '2', '3', '4', '5', '6', '7'])
  })
})
