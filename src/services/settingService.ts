// 환경 설정 API 서비스 (docs/api/02-management.md §3·§5, docs/api/04-board.md §3.7).
import { apiClient } from '@/lib/apiClient'
import type {
  BoardAlarmPayload,
  CompanySettingPayload,
  UserBoardSetting,
  UserSettingPayload,
} from '@/types/setting'
import type { CompanySetting, CompanyUserSetting } from '@/types/user'

// 본인 개인 알림 설정(댓글/좋아요/공지/게시글). 관리자 권한 불필요 — 항상 요청자 본인 것만 바뀐다.
export async function updateUserSetting(
  companySettingId: string,
  payload: UserSettingPayload,
  lang: string,
): Promise<CompanyUserSetting> {
  const { data } = await apiClient.post<CompanyUserSetting>(
    `/management/user-setting/${companySettingId}`,
    payload,
    { headers: { lang } },
  )
  return data
}

// 회사 설정(최신글 노출 기간 등). office 관리자 + 회사 일치가 아니면 403.
export async function updateCompanySetting(
  companySettingId: string,
  payload: CompanySettingPayload,
  lang: string,
): Promise<CompanySetting> {
  const { data } = await apiClient.post<CompanySetting>(
    `/management/company-setting/${companySettingId}`,
    payload,
    { headers: { lang } },
  )
  return data
}

// ⚠ 이름은 member지만 게시판별 '내' 알림 설정. 최초 호출 시 레코드가 생성된다.
export async function updateBoardAlarm(
  boardId: string,
  payload: BoardAlarmPayload,
  lang: string,
): Promise<UserBoardSetting> {
  const { data } = await apiClient.post<UserBoardSetting>(`/board/member/${boardId}`, payload, {
    headers: { lang },
  })
  return data
}
