import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { isAuthenticated } from '@/lib/authStorage'
import { selectDriveFiles } from '@/services/driveService'
import type { DriveFileListParams } from '@/types/drive'

// 자료실 파일 목록 조회. lang 헤더=현재 언어, 토큰 있을 때만 호출.
export function useDriveFiles(params: DriveFileListParams) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['drive-files', params, i18n.language],
    queryFn: () => selectDriveFiles(params, i18n.language),
    placeholderData: keepPreviousData,
    enabled: isAuthenticated(),
  })
}
