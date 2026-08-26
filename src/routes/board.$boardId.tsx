import { createFileRoute } from '@tanstack/react-router'

import { BoardListScreen } from '@/components/board/BoardListScreen'

export const Route = createFileRoute('/board/$boardId')({
  component: BoardListScreen,
})
