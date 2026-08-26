// 글쓰기(화면 05) 데모 데이터 (백엔드 연동 전 — 추후 apiClient)

export const BOARD_OPTIONS = ['공지사항', '자유게시판', '전사 업무 협조 요청 게시판']

export const ORG_ROOT = '지란지교소프트'
export const ORG_KIDS: { label: string; count: number }[] = [
  { label: '인사팀', count: 8 },
  { label: '총무팀', count: 5 },
  { label: '재무팀', count: 4 },
  { label: '개발본부', count: 32 },
]

export const WRITE_ATTACHMENTS: {
  ext: string
  name: string
  size: string | null
  bg: string
  progress: number | null
}[] = [
  { ext: 'PDF', name: 'VPN 설치 가이드_v2.pdf', size: '1.8MB', bg: 'bg-l-red', progress: null },
  { ext: 'PNG', name: '설정 화면 캡쳐 모음.png', size: null, bg: 'bg-l-purple', progress: 45 },
]

export const DRAFT_COUNT = 3
export const TITLE_MAX = 200
