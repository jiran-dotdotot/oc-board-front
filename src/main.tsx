import { StrictMode } from 'react'

import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'

import './index.css'
import { routeTree } from './routeTree.gen'
import '@/lib/i18n'
import { queryClient } from '@/lib/queryClient'
import { createRoot } from 'react-dom/client'

if (import.meta.env.DEV) import('./dev/ping')

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
