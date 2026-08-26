import { createFileRoute } from '@tanstack/react-router'

import { AdminGate } from '@/components/admin/AdminGate'

export const Route = createFileRoute('/admin')({
  component: AdminGate,
})
