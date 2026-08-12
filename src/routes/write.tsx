import { createFileRoute } from '@tanstack/react-router'

import { PostForm } from '@/components/board/PostForm'

export const Route = createFileRoute('/write')({
  component: PostForm,
})
