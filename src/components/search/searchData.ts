// 검색(화면 06) 데모 데이터 (백엔드 연동 전 — 추후 apiClient)

export const DEFAULT_QUERY = '워크샵'
export const RECENTS = ['워크샵', '보안 정책', '온보딩 가이드', '카페테리아']

export interface SearchPost {
  id: number
  title: string
  snippet: string
  board: string
  author: string
  date: string
  hasFile: boolean
  comments: number
}

export const POST_RESULTS: SearchPost[] = [
  {
    id: 3,
    title: '2026년 하반기 전사 워크샵 일정 안내',
    snippet:
      '이번 워크샵은 9월 둘째 주 제주에서 1박 2일로 진행됩니다. 부서별 참석 인원과 사전 설문을 8월 20일까지 회신해 주세요.',
    board: '자유게시판',
    author: '이서연',
    date: '2026.08.05',
    hasFile: true,
    comments: 5,
  },
  {
    id: 6,
    title: '워크샵 예산안 검토 요청의 건',
    snippet:
      '부서별 워크샵 예산 상한과 정산 절차를 정리했습니다. 초과 집행 시 사전 승인 필요합니다.',
    board: '재무팀 소식',
    author: '박지훈',
    date: '2026.07.29',
    hasFile: true,
    comments: 12,
  },
  {
    id: 9,
    title: '작년 전사 워크샵 사진 공유합니다',
    snippet:
      '늦었지만 작년 워크샵 단체사진과 스냅 모음 올립니다. 다운로드는 자료실에서도 가능합니다.',
    board: '자유게시판',
    author: '최현우',
    date: '2026.07.12',
    hasFile: false,
    comments: 0,
  },
]

export interface SearchFile {
  name: string
  ext: string
  tagBg: string
  meta: string
}

export const FILE_RESULTS: SearchFile[] = [
  {
    name: '전사 워크샵 단체사진_원본.png',
    ext: 'PNG',
    tagBg: 'bg-l-purple',
    meta: '자료실 > 팀 자료 · 정다은 · 2026.08.07 · 5.1MB',
  },
  {
    name: '워크샵 예산 집행 내역_07월.xlsx',
    ext: 'XLSX',
    tagBg: 'bg-l-green',
    meta: '자료실 > 재무 · 박지훈 · 2026.07.30 · 318KB',
  },
]

export const PERIOD_PRESETS: { value: string; key: string }[] = [
  { value: '1w', key: 'search-preset-1w' },
  { value: '1m', key: 'search-preset-1m' },
  { value: '3m', key: 'search-preset-3m' },
  { value: '6m', key: 'search-preset-6m' },
  { value: 'custom', key: 'search-preset-custom' },
]
