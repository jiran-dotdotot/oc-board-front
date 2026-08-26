import { createFileRoute } from '@tanstack/react-router'

import { MyActivityScreen } from '@/components/mypage/MyActivityScreen'

export const Route = createFileRoute('/my')({
  component: MyActivityScreen,
})
