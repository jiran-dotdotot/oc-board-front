import { createFileRoute } from '@tanstack/react-router'

import { DriveScreen } from '@/components/drive/DriveScreen'
import { type DriveSearch, parseDriveSearch } from '@/components/drive/driveData'

export const Route = createFileRoute('/drive')({
  // b = 자료실 게시판 id(uuid) · f = 현재 폴더 id. 정렬·페이지·개수는 최근 자료와 같은 파서를 쓴다.
  validateSearch: (search: Record<string, unknown>): DriveSearch => ({
    ...parseDriveSearch(search),
    b: typeof search.b === 'string' && search.b ? search.b : undefined,
    f: typeof search.f === 'string' && search.f ? search.f : undefined,
  }),
  component: DriveScreen,
})
