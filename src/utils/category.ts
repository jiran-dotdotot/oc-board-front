import type { Category, CategoryBoard, CategoryTree } from '@/types/category'

export interface SidebarSection {
  id: string
  name: string
  boards: CategoryBoard[]
}

// 비활성 항목 제외. /category는 서버가 is_active=true로 걸러 주지만
// /category/admin(office 관리자 분기)은 필터가 없어 비활성까지 내려온다 → 여기서 한 번에 거른다.
const isActive = (x: { is_active?: boolean }) => x.is_active !== false

// 카테고리 트리(최대 2depth)를 섹션 목록으로 평탄화. 하위 카테고리도 각자 섹션이 된다.
// 게시판이 없는 카테고리는 사이드바에 노출할 게 없으므로 제외.
export function flattenCategories(categories: Category[] | undefined): SidebarSection[] {
  const out: SidebarSection[] = []
  const walk = (list: Category[]) => {
    for (const c of list) {
      if (!isActive(c)) continue // 비활성 카테고리는 하위까지 통째로 숨김
      const boards = (c.boards ?? []).filter(isActive)
      if (boards.length > 0) out.push({ id: c.id, name: c.name, boards })
      walk(c.child_categories ?? [])
    }
  }
  walk(categories ?? [])
  return out
}

// 사이드바 트리: 루트 카테고리 = 섹션, 그 하위 카테고리 = 접히는 '폴더'(디자인 통합 앱 기준).
// 백엔드 makeCategoryTree가 2depth까지만 안정적으로 중첩하므로 손자 카테고리는 폴더로 평탄화한다.
export interface NavFolder {
  id: string
  name: string
  boards: CategoryBoard[]
}

export interface NavSection {
  id: string
  name: string
  boards: CategoryBoard[] // 폴더에 속하지 않는 카테고리 직속 게시판
  folders: NavFolder[]
}

export function buildNavTree(categories: Category[] | undefined): NavSection[] {
  const out: NavSection[] = []
  for (const c of categories ?? []) {
    if (!isActive(c)) continue // 비활성 카테고리는 하위까지 통째로 숨김
    const folders: NavFolder[] = []
    const collectFolders = (list: Category[]) => {
      for (const child of list) {
        if (!isActive(child)) continue
        const boards = (child.boards ?? []).filter(isActive)
        if (boards.length > 0) folders.push({ id: child.id, name: child.name, boards })
        collectFolders(child.child_categories ?? [])
      }
    }
    collectFolders(c.child_categories ?? [])
    const boards = (c.boards ?? []).filter(isActive)
    if (boards.length === 0 && folders.length === 0) continue
    out.push({ id: c.id, name: c.name, boards, folders })
  }
  return out
}

// 공개 게시판 + 모든 카테고리 게시판을 한 배열로.
export function collectBoards(tree: CategoryTree | undefined): CategoryBoard[] {
  if (!tree) return []
  return [
    ...(tree.public_boards ?? []).filter(isActive),
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
