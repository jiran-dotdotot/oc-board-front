import { createFileRoute } from '@tanstack/react-router'

import { SearchScreen } from '@/components/search/SearchScreen'
import { parseSearchQuery } from '@/components/search/searchParams'

export const Route = createFileRoute('/search')({
  // 검색 상태(검색어·탭·필터·정렬·페이지)의 정본은 URL 이다 — 공유·뒤로가기·새로고침이 살아난다.
  // 기본값은 URL 에 쓰지 않는다(undefined) → 화면이 채운다.
  validateSearch: parseSearchQuery,
  component: SearchScreen,
})
