// GET /api/v1/board/me — docs/api/go/01-auth-user.md#mebody.
// 필요한 응답 필드만 정의한다. 없는 관계는 서버가 null로 반환한다.

export interface CompanySetting {
  id: string
  company_id: number
  latest_post_day: number // 최근글 기준일 (예: 30)
  latest_post_type: string // 'BOARD' 등
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CompanyUserSetting {
  company_id: number
  user_id: number
  is_post_alarm: boolean
  is_notice_alarm: boolean
  is_public_post_alarm: boolean
  is_comment_alarm: boolean
  is_like_alarm: boolean
  recent_search_keyword: string[]
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/**
 * /me 의 소속 관계(01:104-140). `department` 는 **5필드**, `rank` 는 **2필드**만 온다 —
 * role 관계는 없다(01:170).
 * ⚠ `position` 은 직급이 아니라 **정렬용 정수**다. 직급명은 `rank.name` 이다(01:114·139).
 */
export interface MeMember {
  id: number
  department_id: number
  rank_id?: number | null
  /** 부서 내 정렬 순서(정수). 직급명이 아니다. */
  position?: number
  department: { id: number; parent_id?: number | null; name: string; path?: string | null; position?: number } | null
  rank: { id: number; name: string } | null
}

export interface Me {
  id: number
  company_id: number
  rank_id: number | null
  name: string | null
  last_name: string | null
  first_name: string | null
  account: string
  email: string
  code: string | null
  bot: boolean
  status_message: string | null
  working_status: string // 'Online' 등
  status: number
  last_login_at: string | null
  profile_image_id: string | null
  profile_src: string | null
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
  // ── 역할 플래그 ──
  is_admin: boolean // 회사 관리자
  is_category_admin: boolean // 카테고리 관리자
  is_board_admin: boolean // 게시판 관리자
  member: MeMember | null
  company_setting: CompanySetting | null
  company_user_setting: CompanyUserSetting | null
}

// 관리자(슈퍼/카테고리/게시판 중 하나라도) 여부
export function isAnyAdmin(me: Me | undefined | null): boolean {
  return !!me && (me.is_admin || me.is_category_admin || me.is_board_admin)
}
