// GET /api/v1/me — 로그인 사용자 정보 (역할 플래그 포함). 필요한 필드 위주 타이핑(응답의 나머지 필드는 무시).

export interface CompanySetting {
  id: string
  company_id: number
  is_post_alarm: boolean
  is_comment_alarm: boolean
  latest_post_day: number // 최근글 기준일 (예: 30)
  latest_post_type: string // 'BOARD' 등
  latest_post_description: string
  post_badge_type: string // JSON 문자열(뱃지 정의 배열)
  created_at: string
  updated_at: string
  deleted_at: string | null
  company_main_boards: unknown[]
}

export interface CompanyUserSetting {
  id: string
  company_setting_id: string
  company_id: number
  user_id: number
  is_post_alarm: boolean
  is_notice_alarm: boolean
  is_public_post_alarm: boolean
  is_upload_alarm: boolean
  is_comment_alarm: boolean
  is_like_alarm: boolean
  recent_search_keyword: string[]
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Me {
  id: number
  company_id: number
  rank_id: number | null
  name: string
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
  created_at: string
  updated_at: string
  deleted_at: string | null
  // ── 역할 플래그 ──
  is_admin: boolean // 슈퍼관리자
  is_category_admin: boolean // 카테고리 관리자
  is_board_admin: boolean // 게시판 관리자
  member: unknown | null
  company_setting: CompanySetting | null
  company_user_setting: CompanyUserSetting | null
}

// 관리자(슈퍼/카테고리/게시판 중 하나라도) 여부
export function isAnyAdmin(me: Me | undefined | null): boolean {
  return !!me && (me.is_admin || me.is_category_admin || me.is_board_admin)
}
