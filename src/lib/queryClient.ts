import { QueryClient } from '@tanstack/react-query'

// 앱 전역 단일 QueryClient. 기본 옵션은 게시판 성격(자주 안 바뀌는 목록)에 맞춰 보수적으로.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
