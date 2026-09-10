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
  // 화면 간 일회성 안내(글 등록 → 상세의 토스트). URL 이 아니라 history state 에 실어 공유 링크에 남지 않게 한다.
  interface HistoryState {
    toast?: 'write-saved-toast' | 'write-updated-toast' | 'write-scheduled-toast'
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
