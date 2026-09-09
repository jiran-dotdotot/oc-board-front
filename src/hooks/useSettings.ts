import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { updateBoardAlarm } from '@/services/settingService'
import type { BoardAlarmPayload } from '@/types/setting'

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
