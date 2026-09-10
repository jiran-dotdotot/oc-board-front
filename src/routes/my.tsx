import { createFileRoute } from '@tanstack/react-router'

import { MyActivityScreen } from '@/components/mypage/MyActivityScreen'
import { CHIP_ORDER, type ChipKey, MY_TABS, type MyTab } from '@/components/mypage/myParams'
import { LIMIT_OPTIONS } from '@/utils/listLimit'

export interface MySearch {
  chip?: ChipKey
  /** 하위탭. URL 키가 `tab` 이면 /search 의 tab 과 값 집합이 충돌한다(라우터가 검색 파라미터를 합집합으로 본다). */
  kind?: MyTab
  page?: number
  limit?: number
}

export const Route = createFileRoute('/my')({
  // 화면 상태(칩·탭·페이지·개수)의 정본은 URL이다 — 공유·뒤로가기·새로고침이 살아난다.
  // 기본값은 URL에서 생략한다(undefined): 칩=중요, 탭=게시글, 페이지=1,
  // 개수는 화면이 localStorage·기기폭으로 정한다.
  validateSearch: (search: Record<string, unknown>): MySearch => {
    const chip = String(search.chip ?? '') as ChipKey
    const kind = String(search.kind ?? '') as MyTab
    const page = Number(search.page)
    const limit = Number(search.limit)
    return {
      chip: CHIP_ORDER.includes(chip) && chip !== 'important' ? chip : undefined,
      kind: MY_TABS.includes(kind) && kind !== 'post' ? kind : undefined,
      page: Number.isInteger(page) && page > 1 ? page : undefined,
      limit: LIMIT_OPTIONS.includes(limit) ? limit : undefined,
    }
  },
  component: MyActivityScreen,
})
