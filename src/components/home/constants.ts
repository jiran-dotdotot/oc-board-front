// 홈 화면 상수 (최근 게시글/자료는 API로 조회 — RECENT_* 데모 데이터 제거됨)

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
