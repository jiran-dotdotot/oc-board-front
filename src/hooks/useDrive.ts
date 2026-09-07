import { useQuery } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { isAuthenticated } from '@/lib/authStorage'
import { getDrive } from '@/services/driveService'

// 자료실 폴더/용량/권한 (GET /drive/{board}). boardId 가 있어야만 호출한다.
export function useDrive(boardId: string | undefined, folderId: string | undefined) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['drive', boardId, folderId ?? null, i18n.language],
    queryFn: () => getDrive(boardId!, folderId, i18n.language),
    enabled: !!boardId && isAuthenticated(),
    // 삭제된 자료실(404)·읽기 권한 없음(403)은 재시도해도 결과가 같다(useBoard 와 같은 규약).
    retry: (count, err) => {
      const status = (err as { response?: { status?: number } })?.response?.status
      return status !== 404 && status !== 403 && count < 1
    },
  })
}
