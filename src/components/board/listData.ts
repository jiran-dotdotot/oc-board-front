// 글 목록(화면 03) 뷰 타입/상수 (샘플 LIST_ROWS는 API 연동으로 제거됨)

// 레거시 URL(?viewType=)·board.type 과 같은 표기를 쓴다 — 세 곳이 같은 값이면 매핑 코드가 없다.
export type BoardView = 'BOARD' | 'PREVIEW' | 'ALBUM'
export const BOARD_VIEWS: BoardView[] = ['BOARD', 'PREVIEW', 'ALBUM']

// 읽음 필터 — 레거시 ?read= 값 그대로(all=전체, before=안 읽은 글)
export type ReadFilter = 'all' | 'before'

// 목록 화면 URL 상태. 기본값은 URL에서 생략하므로 전부 optional.
export interface BoardListSearch {
  read?: ReadFilter
  page?: number
  limit?: number
  viewType?: BoardView
}

export interface BoardRow {
  id: string | number
  title: string
  board: string // 게시판명 — 전체 목록(/board/recent)의 '위치' 컬럼에서만 쓴다
  author: string
  authorInitial: string
  avatarBg: string // bg-l-* 파스텔
  date: string
  views: number
  likes: number
  comments: number
  notice: boolean
  read: boolean
  bookmarked: boolean // 서버 is_bookmark($appends) — 로컬 상태가 아니다
  hasFile: boolean
  snippet: string
  hasThumb: boolean
  thumbBg: string
}
