import { parseSettingsSearch } from '@/components/settings/settingsParams'
import type { Cat, Folder, Item, TreeNode } from '@/components/settings/types'
import { dndSame, flattenTree, nudge, reorder } from '@/utils/settingsTree'
import { describe, expect, it } from 'vitest'

const cats: Cat[] = [
  { id: 'c1', name: '공용', fixed: true, scope: 'all' },
  { id: 'c2', name: '부서', scope: 'org' },
]
const folders: Folder[] = [{ id: 'f1', name: '경영지원', cat: 'c2', scope: 'org' }]
const items: Item[] = [
  {
    id: 'b1',
    name: '공지',
    type: 'board',
    active: true,
    cat: 'c1',
    folder: null,
    scope: 'all',
    alarm: true,
  },
  {
    id: 'b2',
    name: '인사',
    type: 'board',
    active: false,
    cat: 'c2',
    folder: 'f1',
    scope: 'org',
    alarm: true,
  },
  {
    id: 'd1',
    name: '자료실',
    type: 'drive',
    active: true,
    cat: 'c2',
    folder: null,
    scope: 'all',
    alarm: true,
  },
]

describe('flattenTree', () => {
  const tree = flattenTree(cats, folders, items)

  it('카테고리 → 폴더 → 폴더 안 항목 → 카테고리 직속 항목 순서다(정본 순서)', () => {
    expect(tree.map((n) => n.id)).toEqual(['c1', 'b1', 'c2', 'f1', 'b2', 'd1'])
  })

  it('깊이별 들여쓰기가 카테고리 10 · 폴더/직속 28 · 폴더 안 46 이다', () => {
    const pad = Object.fromEntries(tree.map((n) => [n.id, n.pad]))
    expect(pad).toMatchObject({ c1: 10, b1: 28, c2: 10, f1: 28, b2: 46, d1: 28 })
  })

  it('중지된 항목은 paused, 조직 지정은 scoped 로 표시한다', () => {
    const b2 = tree.find((n) => n.id === 'b2')!
    expect(b2.paused).toBe(true)
    expect(b2.scoped).toBe(true)
    expect(tree.find((n) => n.id === 'd1')!.paused).toBe(false)
  })

  it('종류를 게시판/자료실로 구분해 아이콘 분기를 만든다', () => {
    expect(tree.find((n) => n.id === 'd1')!.kind).toBe('drive')
    expect(tree.find((n) => n.id === 'b1')!.kind).toBe('board')
  })
})

describe('dndSame — 같은 형제 그룹 안에서만 이동', () => {
  const node = (over: Partial<TreeNode>): TreeNode => ({
    kind: 'board',
    id: 'x',
    name: 'x',
    pad: 0,
    paused: false,
    scoped: false,
    cat: 'c1',
    folder: null,
    ...over,
  })

  it('카테고리끼리는 항상 허용', () => {
    expect(dndSame(node({ kind: 'cat', id: 'a' }), node({ kind: 'cat', id: 'b' }))).toBe(true)
  })

  it('폴더는 같은 카테고리 안에서만', () => {
    const a = node({ kind: 'folder', id: 'a', cat: 'c1' })
    expect(dndSame(a, node({ kind: 'folder', id: 'b', cat: 'c1' }))).toBe(true)
    expect(dndSame(a, node({ kind: 'folder', id: 'b', cat: 'c2' }))).toBe(false)
  })

  it('게시판·자료실은 같은 카테고리 + 같은 폴더에서만 (서로 섞이는 것은 허용)', () => {
    const a = node({ id: 'a', cat: 'c1', folder: 'f1' })
    expect(dndSame(a, node({ kind: 'drive', id: 'b', cat: 'c1', folder: 'f1' }))).toBe(true)
    expect(dndSame(a, node({ id: 'b', cat: 'c1', folder: null }))).toBe(false)
    expect(dndSame(a, node({ id: 'b', cat: 'c2', folder: 'f1' }))).toBe(false)
  })

  it('종류가 다른 계층끼리는 거부 — 부모를 넘는 이동은 Go 계약에도 없다', () => {
    expect(dndSame(node({ kind: 'cat', id: 'a' }), node({ kind: 'folder', id: 'b' }))).toBe(false)
    expect(dndSame(node({ kind: 'folder', id: 'a' }), node({ id: 'b' }))).toBe(false)
  })

  it('자기 자신과 null 은 거부', () => {
    expect(dndSame(null, node({}))).toBe(false)
    expect(dndSame(node({ id: 'same' }), node({ id: 'same' }))).toBe(false)
  })
})

describe('reorder / nudge', () => {
  const arr = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('before/after 로 앞뒤에 꽂는다', () => {
    expect(reorder(arr, 'c', 'a', 'before').map((x) => x.id)).toEqual(['c', 'a', 'b'])
    expect(reorder(arr, 'a', 'c', 'after').map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })

  it('없는 id 는 원본을 그대로 돌려준다', () => {
    expect(reorder(arr, 'zz', 'a', 'after')).toBe(arr)
    expect(reorder(arr, 'a', 'zz', 'after')).toBe(arr)
  })

  it('nudge 는 한 칸 스왑이고 끝을 넘으면 원본이다(키보드 정렬 경로)', () => {
    expect(nudge(arr, 'b', -1).map((x) => x.id)).toEqual(['b', 'a', 'c'])
    expect(nudge(arr, 'b', 1).map((x) => x.id)).toEqual(['a', 'c', 'b'])
    expect(nudge(arr, 'a', -1)).toBe(arr)
    expect(nudge(arr, 'c', 1)).toBe(arr)
  })
})

describe('parseSettingsSearch', () => {
  it('기본 탭(general)과 알 수 없는 값은 생략으로 떨어뜨린다', () => {
    expect(parseSettingsSearch({})).toEqual({ tab: undefined })
    expect(parseSettingsSearch({ tab: 'general' })).toEqual({ tab: undefined })
    expect(parseSettingsSearch({ tab: 'nope' })).toEqual({ tab: undefined })
    expect(parseSettingsSearch({ tab: 7 })).toEqual({ tab: undefined })
  })

  it('main·content 만 URL 에 남는다', () => {
    expect(parseSettingsSearch({ tab: 'main' })).toEqual({ tab: 'main' })
    expect(parseSettingsSearch({ tab: 'content' })).toEqual({ tab: 'content' })
  })
})
