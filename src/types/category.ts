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
  // 회사 관리자 OR 본인/부모 카테고리 관리자 OR 게시판 관리자(04-board.md:57).
  // ⚠ 삭제 권한은 이보다 좁다 — 회사·카테고리 관리자만이다(04-board.md:524).
  can_manage?: boolean
  // 게시판 «전체» 알림 설정. 개인 설정(is_board_member_*)과 다른 값이다(04-board.md:245).
  // ⚠ 게시판 전체에는 `is_comment_alarm` 컬럼이 없다(04-board.md:95).
  is_post_alarm?: boolean
  is_notice_alarm?: boolean
  // 자료실 용량·확장자. BoardColumns 에 실려 오는데 이 타입에 빠져 있었다.
  // byte 단위 int64, null 이면 제한 없음(전체) / 업로더 기본값(파일별). 04-board.md:82-84
  size_limit?: number | null
  size_limit_per_file?: number | null
  // 서버가 **대문자로** 저장·반환한다. 기본 [].
  except_extension?: string[]
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
  // 계산값: parent 가 null 이면 1, 아니면 2. Go 는 2단까지만 만든다(03-category.md:52).
  depth: number
  position: number
  is_active: boolean
  // 이 카테고리의 **직접** 관리자 여부. 부모/회사 관리자를 대체하지 않는다(03-category.md:65).
  is_admin?: boolean
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

/* ── 권한 부여 대상 (grant) ──
   조직도 API(`GET /companies/{cid}/departments`)는 member 토큰 전용이라 이 앱에서 401 이다
   (BR-012) → **새로 «고를» 수는 없고**, 아래 목록으로 현재 지정된 대상을 보여주고
   지우는 것만 가능하다. 근거: docs/api/go/04-board.md:116-155 · 03-category.md:86-110 */

/** grant 에 실려 오는 사용자. `name` 에는 서버가 `(퇴직)`/`(중지)` 접미사를 붙인다. */
export interface GrantUser {
  id: number
  name: string | null
  profile_image_id: string | null
  disabled_at: string | null
  deleted_at: string | null
  profile_src: string | null
}

export interface GrantDepartment {
  id: number
  name: string
}

/** 게시판·카테고리 공통 사용자 grant. surrogate `id` 는 없다. */
export interface UserGrant {
  user_id: number
  // 부재/타회사 사용자면 null 이어도 grant 행은 남는다 → 철회 대상으로 쓸 수 있다.
  user: GrantUser | null
}

export interface DepartmentGrant {
  department_id: number
  department: GrantDepartment | null
}

/** `GET {S}/boards/{id}` — BoardView + grant 3종 + 사용량. */
export interface BoardDetail extends CategoryBoard {
  board_admins: UserGrant[]
  board_members: UserGrant[]
  board_departments: DepartmentGrant[]
  /** DRIVE 의 live 파일 size 합계(byte). non-DRIVE 는 0. */
  total_usage_size: number
}

/** `GET {S}/categories/{id}` — boards·child_categories·개인 알림은 **없다**. */
export interface CategoryDetail {
  id: string
  company_id: number
  parent_category_id: string | null
  name: string
  depth: number
  position: number
  is_active: boolean
  is_admin: boolean
  can_manage: boolean
  category_admins: UserGrant[]
  category_members: UserGrant[]
  category_departments: DepartmentGrant[]
}

/* ── 쓰기 payload ── */

/** `POST {S}/categories` — `name` 필수. */
export interface CategoryCreatePayload {
  name: string
  parent_category_id?: string | null
  is_active?: boolean
  position?: number
}

/** `PUT {S}/categories/{id}` — 생략은 유지. `parent_category_id` 는 보내도 무시된다. */
export interface CategoryUpdatePayload {
  name?: string
  is_active?: boolean
  position?: number
  delete_category_admin_user_id?: number[]
  delete_category_member_user_id?: number[]
  delete_category_department_id?: number[]
}

/**
 * `PUT {S}/category-tree` — **position 만** 바꾼다. 부모 이동은 하지 않는다.
 * 권한 밖·없는 ID 는 조용히 무시되고, 응답 `reordered` 는 UPDATE 매치 행 수이지
 * 요청 개수도 삭제 개수도 아니다(02-management.md:437,447,449).
 */
export interface CategoryTreeReorderPayload {
  update_category_position?: Record<string, number>
  update_board_position?: Record<string, number>
}

export interface CategoryTreeReorderResult {
  reordered: { categories: number; boards: number }
}
