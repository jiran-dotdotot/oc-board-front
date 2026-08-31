import { describe, expect, it } from 'vitest'

import type { Category, CategoryBoard, CategoryTree } from '@/types/category'
import { buildNavTree, collectBoards, flattenCategories } from '@/utils/category'

const board = (id: string, over: Partial<CategoryBoard> = {}) =>
  ({ id, title: id, is_active: true, ...over }) as CategoryBoard

const cat = (id: string, boards: CategoryBoard[], over: Partial<Category> = {}) =>
  ({ id, name: id, is_active: true, boards, child_categories: [], ...over }) as Category

describe('flattenCategories', () => {
  it('비활성 카테고리와 비활성 게시판을 제외한다 (/category/admin 분기 방어)', () => {
    const tree = [
      cat('live', [board('b1'), board('b2', { is_active: false })]),
      cat('dead', [board('b3')], { is_active: false }),
    ]
    const sections = flattenCategories(tree)
    expect(sections.map((s) => s.id)).toEqual(['live'])
    expect(sections[0].boards.map((b) => b.id)).toEqual(['b1'])
  })

  it('하위 카테고리도 각자 섹션이 되고, 게시판 없는 카테고리는 빠진다', () => {
    const tree = [cat('parent', [], { child_categories: [cat('child', [board('b1')])] })]
    expect(flattenCategories(tree).map((s) => s.id)).toEqual(['child'])
  })
})

describe('buildNavTree', () => {
  it('루트=섹션, 하위 카테고리=접히는 폴더로 나눈다', () => {
    const tree = [
      cat('root', [board('own')], {
        child_categories: [cat('folder', [board('inner')])],
      }),
    ]
    const [section] = buildNavTree(tree)
    expect(section.id).toBe('root')
    expect(section.boards.map((b) => b.id)).toEqual(['own'])
    expect(section.folders.map((f) => f.id)).toEqual(['folder'])
    expect(section.folders[0].boards.map((b) => b.id)).toEqual(['inner'])
  })

  it('비활성 항목과 빈 섹션/빈 폴더를 제외한다', () => {
    const tree = [
      cat('empty', []),
      cat('dead', [board('x')], { is_active: false }),
      cat('live', [board('a'), board('off', { is_active: false })], {
        child_categories: [cat('emptyFolder', []), cat('deadFolder', [board('y')], { is_active: false })],
      }),
    ]
    const sections = buildNavTree(tree)
    expect(sections.map((s) => s.id)).toEqual(['live'])
    expect(sections[0].boards.map((b) => b.id)).toEqual(['a'])
    expect(sections[0].folders).toEqual([])
  })
})

describe('collectBoards', () => {
  const tree: CategoryTree = {
    public_boards: [board('pub'), board('pub-off', { is_active: false })],
    categories: [cat('c', [board('mine')])],
  }

  it('비활성 공개 게시판을 제외하고 합친다', () => {
    expect(collectBoards(tree).map((b) => b.id)).toEqual(['pub', 'mine'])
  })
})
