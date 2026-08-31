// 글 목록(화면 03) 뷰 타입/상수 (샘플 LIST_ROWS는 API 연동으로 제거됨)

export type BoardView = 'board' | 'preview' | 'album'

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
