import { parseSettingsSearch } from '@/components/settings/settingsParams'
import { PUBLIC_CAT_ID } from '@/components/settings/types'
import type { NodeDraft, SettingsNode } from '@/components/settings/types'
import type { Category, CategoryBoard, CategoryTree } from '@/types/category'
import { boardUpdatePatch, categoryUpdatePatch, isEmptyPatch } from '@/utils/settingsPayload'
import {
  bytesToLabel,
  capOptions,
  dndSame,
  flattenSettingsTree,
  labelToBytes,
  positionPatch,
  reorder,
} from '@/utils/settingsTree'
import { describe, expect, it } from 'vitest'

const board = (over: Partial<CategoryBoard>): CategoryBoard => ({
  id: 'b',
  company_id: 7,
  category_id: null,
  title: '게시판',
  description: '',
  type: 'BOARD',
  is_active: true,
  is_drive: false,
  is_public: false,
  position: 1,
  read_permission: 'ALL',
  write_permission: 'ALL',
  ...over,
})

const cat = (over: Partial<Category>): Category => ({
  id: 'c',
  company_id: 7,
  parent_category_id: null,
  name: '카테고리',
  depth: 1,
  position: 1,
  is_active: true,
  is_post_alarm: true,
  is_comment_alarm: true,
  boards: [],
  child_categories: [],
  ...over,
})

const tree: CategoryTree = {
  public_boards: [board({ id: 'pb', title: '공지사항', position: 1 })],
  categories: [
    cat({
      id: 'c1',
      name: '부서',
      position: 1,
      is_admin: true,
      boards: [board({ id: 'b1', title: '자유게시판', position: 2, category_id: 'c1' })],
      child_categories: [
        cat({
          id: 'f1',
          name: '경영지원',
          parent_category_id: 'c1',
          depth: 2,
          position: 1,
          boards: [
            board({
              id: 'b2',
              title: '인사팀',
              position: 1,
              category_id: 'f1',
              is_active: false,
              is_category_admin: true,
            }),
            board({
              id: 'd1',
              title: '자료실',
              position: 2,
              category_id: 'f1',
              type: 'DRIVE',
              is_drive: true,
            }),
          ],
        }),
      ],
    }),
  ],
}

describe('flattenSettingsTree', () => {
  const nodes = flattenSettingsTree(tree, { isOfficeAdmin: true }, '공용')

  it('「공용」 고정 노드 → 공용 게시판 → 카테고리 → 폴더 → 폴더 안 → 직속 순서다(정본 순서)', () => {
    expect(nodes.map((n) => n.id)).toEqual([PUBLIC_CAT_ID, 'pb', 'c1', 'f1', 'b2', 'd1', 'b1'])
  })

  it('depth 는 카테고리 0 · 폴더/직속 1 · 폴더 안 2 다', () => {
    const depth = Object.fromEntries(nodes.map((n) => [n.id, n.depth]))
    expect(depth).toMatchObject({ c1: 0, f1: 1, b1: 1, b2: 2, d1: 2, pb: 1 })
  })

  it('「공용」 은 fixed 이고 편집·삭제 대상이 아니다 — Go 에 그런 카테고리 행이 없다', () => {
    const pub = nodes.find((n) => n.id === PUBLIC_CAT_ID)!
    expect(pub.fixed).toBe(true)
    expect(pub.canManage).toBe(false)
    expect(pub.canDelete).toBe(false)
  })

  it('회사 관리자가 아니면 공용 노드가 없다 — /categories/management 가 공용을 주지 않는다', () => {
    const only = flattenSettingsTree(
      { public_boards: [], categories: tree.categories },
      { isOfficeAdmin: false },
      '공용',
    )
    expect(only.some((n) => n.id === PUBLIC_CAT_ID)).toBe(false)
  })

  it('자료실은 kind=drive, 중지된 게시판은 paused 다', () => {
    expect(nodes.find((n) => n.id === 'd1')!.kind).toBe('drive')
    expect(nodes.find((n) => n.id === 'b2')!.paused).toBe(true)
  })

  it('게시판 삭제 권한은 회사·카테고리 관리자만이다 (can_manage 보다 좁다)', () => {
    const asMember = flattenSettingsTree(tree, { isOfficeAdmin: false }, '공용')
    // b2 는 is_category_admin=true → 삭제 가능, b1 은 아니다
    expect(asMember.find((n) => n.id === 'b2')!.canDelete).toBe(true)
    expect(asMember.find((n) => n.id === 'b1')!.canDelete).toBe(false)
  })

  it('부모 카테고리 관리자는 자식 폴더도 관리할 수 있다(CanManage = 본인/부모 1홉)', () => {
    const asMember = flattenSettingsTree(tree, { isOfficeAdmin: false }, '공용')
    expect(asMember.find((n) => n.id === 'f1')!.canManage).toBe(true)
  })
})

describe('dndSame — 같은 형제 그룹 안에서만 이동', () => {
  const node = (over: Partial<SettingsNode>): SettingsNode => ({
    kind: 'board',
    id: 'x',
    name: 'x',
    depth: 1,
    position: 1,
    paused: false,
    scoped: false,
    parentCat: 'c1',
    parentFolder: null,
    canManage: true,
    canDelete: true,
    ...over,
  })

  it('카테고리끼리는 항상 허용', () => {
    expect(dndSame(node({ kind: 'cat', id: 'a' }), node({ kind: 'cat', id: 'b' }))).toBe(true)
  })

  it('폴더는 같은 카테고리 안에서만', () => {
    const a = node({ kind: 'folder', id: 'a', parentCat: 'c1' })
    expect(dndSame(a, node({ kind: 'folder', id: 'b', parentCat: 'c1' }))).toBe(true)
    expect(dndSame(a, node({ kind: 'folder', id: 'b', parentCat: 'c2' }))).toBe(false)
  })

  it('게시판·자료실은 같은 카테고리 + 같은 폴더에서만 (서로 섞이는 것은 허용)', () => {
    const a = node({ id: 'a', parentCat: 'c1', parentFolder: 'f1' })
    expect(dndSame(a, node({ kind: 'drive', id: 'b', parentCat: 'c1', parentFolder: 'f1' }))).toBe(
      true,
    )
    expect(dndSame(a, node({ id: 'b', parentCat: 'c1', parentFolder: null }))).toBe(false)
    expect(dndSame(a, node({ id: 'b', parentCat: 'c2', parentFolder: 'f1' }))).toBe(false)
  })

  it('종류가 다른 계층끼리는 거부 — 부모를 넘는 이동은 Go 계약에도 없다', () => {
    expect(dndSame(node({ kind: 'cat', id: 'a' }), node({ kind: 'folder', id: 'b' }))).toBe(false)
    expect(dndSame(node({ kind: 'folder', id: 'a' }), node({ id: 'b' }))).toBe(false)
  })

  it('자기 자신과 null 은 거부', () => {
    expect(dndSame(null, node({}))).toBe(false)
    expect(dndSame(node({ id: 'same' }), node({ id: 'same' }))).toBe(false)
  })

  it('「공용」 고정 노드는 순서를 바꿀 수 없다', () => {
    const pub = node({ kind: 'cat', id: PUBLIC_CAT_ID, fixed: true })
    expect(dndSame(pub, node({ kind: 'cat', id: 'c1' }))).toBe(false)
    expect(dndSame(node({ kind: 'cat', id: 'c1' }), pub)).toBe(false)
  })
})

describe('reorder', () => {
  const arr = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('before/after 로 앞뒤에 꽂는다', () => {
    expect(reorder(arr, 'c', 'a', 'before').map((x) => x.id)).toEqual(['c', 'a', 'b'])
    expect(reorder(arr, 'a', 'c', 'after').map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })

  it('없는 id 는 원본을 그대로 돌려준다', () => {
    expect(reorder(arr, 'zz', 'a', 'after')).toBe(arr)
    expect(reorder(arr, 'a', 'zz', 'after')).toBe(arr)
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

describe('positionPatch — 바뀐 항목만, 기존 position 을 재사용', () => {
  it('두 항목을 맞바꾸면 그 둘만 담는다', () => {
    const patch = positionPatch([
      { id: 'a', position: 2 },
      { id: 'b', position: 1 },
      { id: 'c', position: 3 },
    ])
    expect(patch).toEqual({ a: 1, b: 2 })
  })

  it('순서가 그대로면 빈 객체다 — 아무것도 보내지 않는다', () => {
    expect(
      positionPatch([
        { id: 'a', position: 1 },
        { id: 'b', position: 2 },
      ]),
    ).toEqual({})
  })

  it('부분 트리에서도 «원래 있던» position 값만 쓴다 (index+1 을 새로 만들지 않는다)', () => {
    // 비회사관리자는 /categories/management 로 부분 목록만 받는다. 전역 position 이
    // 7·9 라면 그 두 값만 서로 바꿔야 하고, 1·2 를 새로 만들면 안 보이는 형제와 충돌한다.
    const patch = positionPatch([
      { id: 'x', position: 9 },
      { id: 'y', position: 7 },
    ])
    expect(patch).toEqual({ x: 7, y: 9 })
  })
})

describe('용량 라벨 ↔ byte', () => {
  it('왕복한다', () => {
    for (const label of ['100MB', '500MB', '1GB', '5GB', '10GB', '50GB']) {
      expect(bytesToLabel(labelToBytes(label)!)).toBe(label)
    }
  })

  it('정본 칩에 없는 기존 값은 칩으로 «덧붙여» 보존한다 — 저장 시 조용히 바뀌면 안 된다', () => {
    const presets = ['100MB', '500MB', '1GB']
    expect(capOptions(labelToBytes('250MB'), presets)).toEqual([...presets, '250MB'])
    expect(capOptions(labelToBytes('500MB'), presets)).toEqual(presets)
  })

  it('제한 없음(null·0)이면 프리셋 그대로다', () => {
    expect(capOptions(null, ['1GB'])).toEqual(['1GB'])
    expect(capOptions(0, ['1GB'])).toEqual(['1GB'])
  })

  it('알 수 없는 라벨은 null(= 제한 없음)', () => {
    expect(labelToBytes('무제한')).toBeNull()
    expect(labelToBytes('')).toBeNull()
  })
})

describe('boardUpdatePatch — 바뀐 필드만', () => {
  const base: NodeDraft = {
    name: '자유게시판',
    type: 'BOARD',
    is_active: true,
    is_post_alarm: true,
    size_limit: null,
    size_limit_per_file: null,
    except_extension: [],
  }

  it('아무것도 안 바뀌면 빈 패치다 (값이 같아도 키를 보내면 updated_at 이 갱신된다)', () => {
    expect(boardUpdatePatch(base, { ...base })).toEqual({})
    expect(isEmptyPatch(boardUpdatePatch(base, { ...base }))).toBe(true)
  })

  it('이름은 title 로 나간다', () => {
    expect(boardUpdatePatch(base, { ...base, name: '새 이름' })).toEqual({ title: '새 이름' })
  })

  it('non-DRIVE 는 용량·확장자 키를 «이름조차» 싣지 않는다 — 422 BOARD_DRIVE_BOUNDARY', () => {
    const patch = boardUpdatePatch(base, {
      ...base,
      size_limit: 1024,
      size_limit_per_file: 512,
      except_extension: ['EXE'],
    })
    expect('size_limit' in patch).toBe(false)
    expect('size_limit_per_file' in patch).toBe(false)
    expect('except_extension' in patch).toBe(false)
  })

  it('DRIVE 는 용량·확장자를 싣는다', () => {
    const drive: NodeDraft = { ...base, type: 'DRIVE' }
    const patch = boardUpdatePatch(drive, { ...drive, size_limit: 1024, except_extension: ['EXE'] })
    expect(patch).toEqual({ size_limit: 1024, except_extension: ['EXE'] })
  })

  it('category_id·is_comment_alarm 은 어떤 경우에도 들어가지 않는다 — 둘 다 400 이다', () => {
    const patch = boardUpdatePatch(base, {
      ...base,
      name: 'x',
      type: 'DRIVE',
      is_active: false,
      is_post_alarm: false,
      size_limit: 1,
    })
    expect('category_id' in patch).toBe(false)
    expect('is_comment_alarm' in patch).toBe(false)
  })

  it('is_notice_alarm 도 보내지 않는다 — 정본에 컨트롤이 없어 서버 값을 유지한다', () => {
    expect('is_notice_alarm' in boardUpdatePatch(base, { ...base, name: 'x' })).toBe(false)
  })
})

describe('categoryUpdatePatch', () => {
  it('바뀐 것만 담고, 없으면 빈 패치다', () => {
    const orig = { name: '부서', is_active: true }
    expect(categoryUpdatePatch(orig, { ...orig })).toEqual({})
    expect(categoryUpdatePatch(orig, { name: '조직', is_active: true })).toEqual({ name: '조직' })
    expect(categoryUpdatePatch(orig, { name: '부서', is_active: false })).toEqual({
      is_active: false,
    })
  })
})
