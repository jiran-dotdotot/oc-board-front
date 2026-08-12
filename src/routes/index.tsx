import { createFileRoute } from '@tanstack/react-router'

import { BoardList } from '@/components/board/BoardList'

export const Route = createFileRoute('/')({
  component: BoardList,
})
