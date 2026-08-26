// GET /api/v1/category — 내 카테고리 트리 + 전사 공개 게시판 (docs/api/03-category.md §1)

export type BoardType = 'BOARD' | 'PREVIEW' | 'ALBUM' | 'DRIVE'

// 카테고리 트리에 실려 오는 게시판 노드.
// 계산 플래그(is_writable/is_bookmark/is_admin/is_category_admin)는 raw SQL alias라
// 모델 캐스팅이 안 걸린다 → boolean이 아닐 수 있어 unknown으로 받고 truthy 판정한다.
export interface CategoryBoard {
  id: string
  company_id: number
  category_id: string | null
  title: string
  description: string
  type: BoardType
  is_active: boolean
  is_drive: boolean
  is_public: boolean
  position: number
  read_permission: 'ALL' | 'ADMIN' | 'MEMBER'
  write_permission: 'ALL' | 'ADMIN' | 'MEMBER'
  is_writable?: unknown
  is_bookmark?: unknown
  is_admin?: unknown
  is_category_admin?: unknown
}

export interface Category {
  id: string
  company_id: number
  parent_category_id: string | null
  name: string
  depth: number
  position: number
  is_active: boolean
  is_post_alarm: boolean
  is_comment_alarm: boolean
  boards: CategoryBoard[]
  // ⚠ 백엔드 makeCategoryTree 한계로 2depth(1→2)까지만 안정적으로 중첩됨
  child_categories: Category[]
}

export interface CategoryTree {
  public_boards: CategoryBoard[]
  categories: Category[]
}

// 자료실 게시판 여부 (is_drive와 type 둘 다 확인 — 구데이터 방어)
export function isDriveBoard(b: CategoryBoard): boolean {
  return !!b.is_drive || b.type === 'DRIVE'
}
