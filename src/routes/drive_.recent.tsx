import { createFileRoute } from '@tanstack/react-router'

import { DriveScreen } from '@/components/drive/DriveScreen'
import { type DriveRecentSearch, parseDriveSearch } from '@/components/drive/driveData'

// 파일명의 트레일링 `_` = 부모(`/drive`) 레이아웃에 중첩하지 않는다.
// `drive.tsx` 는 Outlet 이 없는 leaf 라, 부모가 되면 `/drive` 자체가 렌더되지 않는다.
export const Route = createFileRoute('/drive_/recent')({
  // 목록 상태의 정본은 URL. 기본값(최신순·1페이지)은 URL 에서 생략한다.
  validateSearch: (search: Record<string, unknown>): DriveRecentSearch => parseDriveSearch(search),
  component: () => <DriveScreen recent />,
})
