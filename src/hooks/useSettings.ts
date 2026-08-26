import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import {
  updateBoardAlarm,
  updateCompanySetting,
  updateUserSetting,
} from '@/services/settingService'
import type { BoardAlarmPayload, CompanySettingPayload, UserSettingPayload } from '@/types/setting'

// 개인/회사 설정은 /me 응답에 실려 오므로 저장 후 me를 무효화해 다시 읽는다.
// (useMe는 staleTime Infinity + localStorage 시드라 invalidate가 유일한 갱신 경로)
export function useUserSettingMutation(companySettingId: string | undefined) {
  const { i18n } = useTranslation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UserSettingPayload) =>
      updateUserSetting(companySettingId!, payload, i18n.language),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })
}

export function useCompanySettingMutation(companySettingId: string | undefined) {
  const { i18n } = useTranslation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CompanySettingPayload) =>
      updateCompanySetting(companySettingId!, payload, i18n.language),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })
}

// 게시판별 내 알림 설정. 값은 카테고리 트리(/category)에 실려 오므로 그쪽을 무효화한다.
export function useBoardAlarmMutation() {
  const { i18n } = useTranslation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ boardId, payload }: { boardId: string; payload: BoardAlarmPayload }) =>
      updateBoardAlarm(boardId, payload, i18n.language),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}
