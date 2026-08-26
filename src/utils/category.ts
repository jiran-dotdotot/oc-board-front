import type { Category, CategoryBoard, CategoryTree } from '@/types/category'

export interface SidebarSection {
  id: string
  name: string
  boards: CategoryBoard[]
}

// 카테고리 트리(최대 2depth)를 섹션 목록으로 평탄화. 하위 카테고리도 각자 섹션이 된다.
// 게시판이 없는 카테고리는 사이드바에 노출할 게 없으므로 제외.
export function flattenCategories(categories: Category[] | undefined): SidebarSection[] {
  const out: SidebarSection[] = []
  const walk = (list: Category[]) => {
    for (const c of list) {
      const boards = c.boards ?? []
      if (boards.length > 0) out.push({ id: c.id, name: c.name, boards })
      walk(c.child_categories ?? [])
    }
  }
  walk(categories ?? [])
  return out
}

// 공개 게시판 + 모든 카테고리 게시판을 한 배열로.
export function collectBoards(tree: CategoryTree | undefined): CategoryBoard[] {
  if (!tree) return []
  return [
    ...(tree.public_boards ?? []),
    ...flattenCategories(tree.categories).flatMap((s) => s.boards),
  ]
}

// 즐겨찾기(북마크) 게시판. is_bookmark는 raw SQL alias라 truthy로 판정.
export function favoriteBoards(tree: CategoryTree | undefined): CategoryBoard[] {
  return collectBoards(tree).filter((b) => !!b.is_bookmark)
}

export function findBoard(tree: CategoryTree | undefined, id: string | undefined) {
  if (!id) return undefined
  return collectBoards(tree).find((b) => b.id === id)
}
