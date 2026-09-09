import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { MemberTokenRequiredError, updateBoardAlarm } from '@/services/settingService'
import type { BoardAlarmPayload, CompanySettingPayload, UserSettingPayload } from '@/types/setting'

/**
 * 개인 알림·회사 설정 저장은 Go 에서 member 토큰 전용 management 경로로 옮겨져
 * 이 앱(board 토큰)으로는 호출할 수 없다 — BR-005.
 * 조용히 실패시키지 않으려고 mutation 을 남기되 항상 거절하고,
 * `isSupported === false` 로 화면이 컨트롤을 비활성화하게 한다.
 */
const MEMBER_TOKEN_ONLY = { isSupported: false as const }

const rejectMemberTokenOnly = () => Promise.reject(new MemberTokenRequiredError())

export function useUserSettingMutation(companySettingId: string | undefined) {
  void companySettingId // Go 계약에 이 경로가 없다 — 시그니처만 유지한다
  const mutation = useMutation<never, Error, UserSettingPayload>({
    mutationFn: rejectMemberTokenOnly,
  })
  return Object.assign(mutation, MEMBER_TOKEN_ONLY)
}

export function useCompanySettingMutation(companySettingId: string | undefined) {
  void companySettingId
  const mutation = useMutation<never, Error, CompanySettingPayload>({
    mutationFn: rejectMemberTokenOnly,
  })
  return Object.assign(mutation, MEMBER_TOKEN_ONLY)
}

// 게시판별 내 알림 설정. 값은 카테고리 트리(/category)에 실려 오므로 그쪽을 무효화한다.
export function useBoardAlarmMutation() {
  const { i18n } = useTranslation()
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ boardId, payload }: { boardId: string; payload: BoardAlarmPayload }) =>
      updateBoardAlarm(boardId, payload, i18n.language),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
  return Object.assign(mutation, { isSupported: true as const })
}
