// 환경 설정 관련 요청/응답 타입 (docs/api/go/02-management.md · go/04-board.md:603)

// POST /management/user-setting/{companySetting} — 본인 개인 알림 설정 (검증 없음, fillable만 반영)
export interface UserSettingPayload {
  is_post_alarm?: boolean
  is_notice_alarm?: boolean
  is_public_post_alarm?: boolean
  is_comment_alarm?: boolean
  is_like_alarm?: boolean
}

// POST /management/company-setting/{companySetting} — 회사 설정 (office 관리자 전용)
// ⚠ edit_company_main_board는 JSON '문자열'이라 여기선 다루지 않는다(메인 게시판 편집 미구현).
export interface CompanySettingPayload {
  is_post_alarm?: boolean
  is_comment_alarm?: boolean
  latest_post_day?: number
  latest_post_type?: string
  latest_post_description?: string
}

// POST /board/member/{board} — ⚠ 멤버 관리가 아니라 '본인의 게시판 알림 설정'
export interface BoardAlarmPayload {
  is_post_alarm?: boolean
  is_notice_alarm?: boolean
  is_comment_alarm?: boolean
}

export interface UserBoardSetting {
  id: string
  user_id: number
  board_id: string
  category_id: string | null
  is_post_alarm: boolean
  is_notice_alarm: boolean
  is_comment_alarm: boolean
}
