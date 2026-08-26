import { createFileRoute } from '@tanstack/react-router'

import { DriveScreen } from '@/components/drive/DriveScreen'

export const Route = createFileRoute('/drive')({
  // b = 자료실 게시판 id(uuid). 미지정이면 접근 가능한 전체 자료실 파일.
  validateSearch: (search: Record<string, unknown>): { b?: string } => ({
    b: typeof search.b === 'string' && search.b ? search.b : undefined,
  }),
  component: DriveScreen,
})
