import { createFileRoute } from '@tanstack/react-router'

import { BoardListScreen } from '@/components/board/BoardListScreen'
import { LIMIT_OPTIONS } from '@/components/board/constants'
import { BOARD_VIEWS, type BoardListSearch, type BoardView } from '@/components/board/listData'

export const Route = createFileRoute('/board/$boardId')({
  // 목록 상태(읽음 필터·페이지·개수·뷰타입)의 정본은 URL이다 — 공유·뒤로가기·새로고침이 살아난다.
  // 파라미터 이름·값은 레거시(jupiter-board-web) ?read=&page=&limit=&viewType= 와 호환된다.
  // 기본값은 URL에서 생략한다(undefined) → 개수 기본값은 화면이 localStorage·기기폭으로 정하고,
  // 뷰타입 기본값은 게시판의 board.type 이 된다.
  validateSearch: (search: Record<string, unknown>): BoardListSearch => {
    const page = Number(search.page)
    const limit = Number(search.limit)
    const viewType = String(search.viewType ?? '') as BoardView
    return {
      read: search.read === 'before' ? 'before' : undefined,
      page: Number.isInteger(page) && page > 1 ? page : undefined,
      limit: LIMIT_OPTIONS.includes(limit) ? limit : undefined,
      viewType: BOARD_VIEWS.includes(viewType) ? viewType : undefined,
    }
  },
  component: BoardListScreen,
})
