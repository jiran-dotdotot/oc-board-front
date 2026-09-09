// 환경 설정 API 서비스.
// ⚠ 개인 알림·회사 설정은 Go 에서 management 도메인(/api/v1/companies/{company_id}/settings…)으로
//   옮겨졌고 **OfficeWave member 토큰 전용**이다 — "board 토큰을 이 경로에 재사용하지 않는다"
//   (docs/api/go/02-management.md:313). 이 앱은 /board/login 으로 board 토큰만 받으므로
//   호출 자체가 불가능하다(실측 2026-09-09: board 토큰으로 401 UNAUTHORIZED).
//   → 화면에서 해당 컨트롤을 비활성으로 두고, 계약 요청은 BR-005 로 올렸다.
//   여기에 임의 경로/토큰을 발명하지 않는다.
import { putBoardResource } from '@/lib/boardApi'
import type { BoardAlarmPayload, UserBoardSetting } from '@/types/setting'

/** 개인 알림·회사 설정 저장이 이 앱의 토큰으로 불가능함을 호출부에 알리는 표식. */
export class MemberTokenRequiredError extends Error {
  constructor() {
    super('This setting requires an OfficeWave member token (docs/api/go/02-management.md:313)')
    this.name = 'MemberTokenRequiredError'
  }
}

// 게시판별 '내' 알림 설정. 최초 호출 시 레코드가 생성되며 미지정 플래그는 유지된다.
// 게시판 전체의 is_post_alarm/is_notice_alarm 과는 «별개»인 본인 설정이다
// (docs/api/go/04-board.md:603, 주의사항).
export async function updateBoardAlarm(
  boardId: string,
  payload: BoardAlarmPayload,
  lang: string,
): Promise<UserBoardSetting> {
  const { data } = await putBoardResource<UserBoardSetting>(
    `/boards/${boardId}/my-notification`,
    payload,
    { headers: { lang } },
  )
  return data
}
