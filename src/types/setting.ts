// 환경 설정 관련 요청/응답 타입 (docs/api/go/02-management.md · go/04-board.md:603)

// PATCH /api/v1/companies/{cid}/settings/users/me — 본인 개인 알림 (⚠ member 토큰 전용, BR-012)
// 전부 legacy.Bool: true/false/0/1/"0"/"1"/"true"/"false"/null 만 통과. 생략·null 은 유지.
export interface UserSettingPayload {
  is_post_alarm?: boolean
  is_notice_alarm?: boolean
  is_public_post_alarm?: boolean
  is_comment_alarm?: boolean
  is_like_alarm?: boolean
}

// PATCH /api/v1/companies/{cid}/settings — 회사 설정 (⚠ member 토큰 + 회사 관리자 전용, BR-012)
// latest_post_day/latest_post_type 은 HTTP 검증이 없어 DB CHECK 위반이 500 으로 나온다(BR-018).
// ⚠ edit_company_main_board는 JSON '문자열'이라 여기선 다루지 않는다(메인 게시판 편집 미구현).
export interface CompanySettingPayload {
  is_post_alarm?: boolean
  is_comment_alarm?: boolean
  latest_post_day?: number
  latest_post_type?: string
  latest_post_description?: string
}

// PUT {S}/boards/{id}/my-notification — ⚠ 멤버 관리가 아니라 '본인의 게시판 알림 설정'
// board 토큰으로 호출 가능하다(04-board.md:619-659). 추가 키는 400.
export interface BoardAlarmPayload {
  is_post_alarm?: boolean
  is_notice_alarm?: boolean
  is_comment_alarm?: boolean
}

// 응답 필드는 이 5개뿐이다 — 타임스탬프·관계 없음(04-board.md:647-653).
// 이전 정의에 있던 `id`·`category_id` 는 **서버가 보내지 않는다.**
export interface UserBoardSetting {
  board_id: string
  user_id: number
  is_post_alarm: boolean
  is_notice_alarm: boolean
  is_comment_alarm: boolean
}
