// 환경 설정 API 서비스.
// 개인 알림·회사 설정은 관리 도메인(`{company}/settings…`)이고 **member 계약**이다.
// `ebff9af` 이전에는 이 앱이 board 토큰만 받아 호출 자체가 불가능했으나(BR-012),
// 로그인을 OfficeWave 로 전환하면서 그 토큰을 갖게 됐다 → 화면의 비활성 게이트를 걷었다.
// 실측 2026-09-10: PATCH `{company}/settings/users/me` · PATCH `{company}/settings` 모두 200.
import { patchCompanyResource, putBoardResource } from '@/lib/boardApi'
import type {
  BoardAlarmPayload,
  CompanySettingPayload,
  UserBoardSetting,
  UserSettingPayload,
} from '@/types/setting'
import type { CompanySetting, CompanyUserSetting } from '@/types/user'

/**
 * 본인 개인 알림 4종. 보낸 키만 바뀌고 생략한 키는 유지된다(legacy.Bool).
 * 경로에 `user_id` 가 없다 — 본인은 `/users/me` 리터럴이다.
 */
export async function updateUserSetting(
  payload: UserSettingPayload,
  lang: string,
): Promise<CompanyUserSetting> {
  const { data } = await patchCompanyResource<CompanyUserSetting>('/settings/users/me', payload, {
    headers: { Lang: lang },
  })
  return data
}

/**
 * 회사 설정(메인화면 최신글 기간). **회사 관리자만** 통과한다 — 권한은 서버가 판정한다.
 * `latest_post_day` 는 HTTP 검증이 없어 DB CHECK 위반이 500 으로 나온다(BR-018) →
 * 화면이 정해진 보기(DAY_OPTS) 밖의 값을 보내지 않는다.
 */
export async function updateCompanySetting(
  payload: CompanySettingPayload,
  lang: string,
): Promise<CompanySetting> {
  const { data } = await patchCompanyResource<CompanySetting>('/settings', payload, {
    headers: { Lang: lang },
  })
  return data
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
