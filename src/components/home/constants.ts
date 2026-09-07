// 홈 화면 상수 (최근 게시글/자료는 API로 조회 — RECENT_* 데모 데이터 제거됨)

// 홈 최근 게시글·최근 자료에 각각 노출할 개수 (게시글 take / 자료 limit).
export const HOME_TAKE = 8

// 해야 할 일 칩 — 디자인은 파스텔 채움이 아니라 중립 아웃라인 pill이다.
export const TODO_PILL =
  'inline-flex h-8 flex-none items-center gap-1.5 rounded-[20px] border border-gray-200 bg-card px-3 text-[12.5px] font-semibold whitespace-nowrap text-gray-700 hover:bg-gray-100'

export const DRAFT_COUNT = 3
export const SCHED_COUNT = 1

// 확장자별 파스텔 배지 색 (OfficeWave l-* 토큰)
export const EXT_BG: Record<string, string> = {
  PDF: 'bg-l-red',
  XLSX: 'bg-l-green',
  CSV: 'bg-l-green',
  PPTX: 'bg-l-orange',
  PNG: 'bg-l-purple',
  JPG: 'bg-l-purple',
  GIF: 'bg-l-purple',
  HWP: 'bg-l-blue',
  DOC: 'bg-l-blue',
  DOCX: 'bg-l-blue',
  ZIP: 'bg-l-gray',
}
export const EXT_BG_DEFAULT = 'bg-l-gray'
