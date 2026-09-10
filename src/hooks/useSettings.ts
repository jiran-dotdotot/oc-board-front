import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import {
  updateBoardAlarm,
  updateCompanySetting,
  updateUserSetting,
} from '@/services/settingService'
import type { BoardAlarmPayload, CompanySettingPayload, UserSettingPayload } from '@/types/setting'
import type { Me } from '@/types/user'

// 게시판별 내 알림 설정. 값은 카테고리 트리(/category)에 실려 오므로 그쪽을 무효화한다.
export function useBoardAlarmMutation() {
  const { i18n } = useTranslation()
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ boardId, payload }: { boardId: string; payload: BoardAlarmPayload }) =>
      updateBoardAlarm(boardId, payload, i18n.language),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
  return mutation
}

/**
 * 개인 알림 4종. 값은 `/me` 에 실려 오는데 응답이 갱신된 설정 전체를 주므로
 * 재조회 대신 캐시를 그 값으로 갈아 끼운다(언어·세션별 키가 여러 벌이라 `setQueriesData`).
 */
export function useUserSettingMutation() {
  const { i18n } = useTranslation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UserSettingPayload) => updateUserSetting(payload, i18n.language),
    onSuccess: (setting) =>
      qc.setQueriesData<Me>({ queryKey: ['me'] }, (me) =>
        me ? { ...me, company_user_setting: setting } : me,
      ),
  })
}

/** 회사 설정(메인화면). 관리자만 성공한다 — 실패는 화면이 토스트로 알린다. */
export function useCompanySettingMutation() {
  const { i18n } = useTranslation()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CompanySettingPayload) => updateCompanySetting(payload, i18n.language),
    onSuccess: (setting) =>
      qc.setQueriesData<Me>({ queryKey: ['me'] }, (me) =>
        me ? { ...me, company_setting: setting } : me,
      ),
  })
}
