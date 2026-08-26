import { createFileRoute } from '@tanstack/react-router'

import { WriteScreen } from '@/components/board/WriteScreen'

export const Route = createFileRoute('/write')({
  component: WriteScreen,
})
