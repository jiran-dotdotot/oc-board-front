// 조직도. `GET {company}/departments` — 근거: docs/api/go/10-upload-department-client.md:271-330.
// ⚠️ 응답은 **루트 노드 하나**다(배열도 페이지 봉투도 아니다). 루트가 없으면 빈 Body 다.
import type { GrantUser } from './category'

/** 조직도의 구성원 행. `user` 는 grant 응답의 사용자와 같은 모양이라 칩에 그대로 쓴다. */
export interface DepartmentMember {
  id: number
  company_id: number
  department_id: number
  user_id: number
  rank_id: number | null
  role_id: number | null
  position: number
  leader: boolean
  user: GrantUser | null
  rank: { id: number; name: string } | null
  role: { id: number; name: string } | null
  department: {
    id: number
    parent_id: number | null
    name: string
    path: string
    position: number
  } | null
}

/**
 * 재귀 부서 노드.
 * - `members` = **직속** 구성원(겸직이면 여러 부서에 중복 등장한다)
 * - `total_members` = 자신+하위 dedupe 집합. 인원수 표시·관리자 전개에 쓴다
 * - `member_count` = 자신+하위 인원 수
 * - `breadcrumbs` 는 `"{1,2,3}"` 형태의 **문자열**이다(배열 아님)
 */
export interface DepartmentNode {
  id: number
  parent_id: number | null
  name: string
  breadcrumbs: string
  member_count: number
  is_category_department: boolean
  members: DepartmentMember[]
  total_members: DepartmentMember[]
  departments: DepartmentNode[]
}

/** 피커가 다루는 선택 상태. 부서와 사용자는 **서로 다른 grant** 라 따로 담는다. */
export interface OrgSelection {
  departmentIds: number[]
  userIds: number[]
}

export const EMPTY_SELECTION: OrgSelection = { departmentIds: [], userIds: [] }
