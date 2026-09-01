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

// 게시판 슬러그 → 이름/설명 (사이드바에서 라우트 파라미터로 넘김). empty=빈 목록 상태 데모용
export const BOARDS: Record<string, { name: string; desc: string; empty?: boolean }> = {
  notice: {
    name: '공지사항',
    desc: '전사 공지와 필독 안내를 모아 보는 게시판입니다. 부서 공지는 각 부서 게시판을 이용해주세요.',
  },
  free: { name: '자유게시판', desc: '자유롭게 이야기를 나누는 공간입니다.' },
  hr: { name: '인사팀 소식', desc: '인사팀의 공지와 안내를 확인하세요.', empty: true },
}
export const DEFAULT_BOARD = BOARDS.notice
