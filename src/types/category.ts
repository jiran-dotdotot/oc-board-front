// Go 카테고리 트리에서 사용하는 필드. docs/api/go/03-category.md:37-73.

export type BoardType = 'BOARD' | 'PREVIEW' | 'ALBUM' | 'DRIVE'

// 카테고리 트리에 실려 오는 게시판 노드.
// Go BoardView의 계산 플래그는 boolean이다(docs/api/go/04-board.md:98-114).
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
  is_writable?: boolean
  is_bookmark?: boolean
  is_admin?: boolean // board/category 관리자; 회사 관리자만이면 false
  is_category_admin?: boolean
  // Go 사용자·관리자 트리에 모두 포함. 설정 행이 없으면 서버가 true를 계산한다.
  is_board_member_post_alarm?: boolean
  is_board_member_notice_alarm?: boolean
  is_board_member_comment_alarm?: boolean
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
  // Go 트리는 직속 자식까지이며 자식의 child_categories는 []다.
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
