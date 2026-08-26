import { createFileRoute } from '@tanstack/react-router'

import { PostDetailScreen } from '@/components/board/PostDetailScreen'

export const Route = createFileRoute('/post/$postId')({
  component: PostDetailScreen,
})
