import { LIMIT_OPTIONS } from '@/utils/listLimit'

// 자료실(화면 07) 뷰모델. 목록=GET /drive/file, 폴더/용량/권한=GET /drive/{board}.

export interface DriveFile {
  id: string | number
  name: string
  ext: string
  tagBg: string
  board: string // 게시판명 — 「최근 자료」의 '위치' 컬럼
  by: string
  mine: boolean
  date: string
  size: string
  bm?: boolean
  src?: string // S3 오브젝트 키 — 다운로드가 이걸로 URL 을 만든다
}

// 표 상단에 고정되는 폴더 행(정본: 페이징 대상이 아니다).
export interface DriveFolderRow {
  id: string
  name: string
  by: string
  date: string
  mine: boolean
}

// 「최근 자료」(/drive/recent) 정렬 — 레거시 drive/recent.vue 의 new · highVolume · lowVolume.
export const DRIVE_SORTS = ['new', 'sizeDesc', 'sizeAsc'] as const
export type DriveSort = (typeof DRIVE_SORTS)[number]

// 정렬 키 → GET /drive/file 의 sort 파라미터
export const DRIVE_SORT_PARAMS = {
  new: { by: 'created_at', order: 'desc' },
  sizeDesc: { by: 'size', order: 'desc' },
  sizeAsc: { by: 'size', order: 'asc' },
} as const satisfies Record<DriveSort, { by: string; order: 'asc' | 'desc' }>

// 정렬 키 → i18n 키
export const DRIVE_SORT_LABEL = {
  new: 'drive-sort-new',
  sizeDesc: 'drive-sort-size-desc',
  sizeAsc: 'drive-sort-size-asc',
} as const

// URL 이 정본인 목록 상태. 기본값(최신순·1페이지)은 URL 에서 생략한다.
export interface DriveRecentSearch {
  sort?: Exclude<DriveSort, 'new'>
  page?: number
  limit?: number
}

// 자료실 목록 상태 = 최근 자료와 같고 + 게시판(b) · 폴더(f).
export interface DriveSearch extends DriveRecentSearch {
  b?: string
  f?: string
}

// 확장자 → 파스텔 배경
export const EXT_BG: Record<string, string> = {
  PDF: 'bg-l-red',
  XLSX: 'bg-l-green',
  XLS: 'bg-l-green',
  CSV: 'bg-l-green',
  PNG: 'bg-l-purple',
  JPG: 'bg-l-purple',
  JPEG: 'bg-l-purple',
  GIF: 'bg-l-purple',
  HWP: 'bg-l-blue',
  DOC: 'bg-l-blue',
  DOCX: 'bg-l-blue',
  PPT: 'bg-l-orange',
  PPTX: 'bg-l-orange',
  ZIP: 'bg-l-gray',
  RAR: 'bg-l-gray',
}
export const EXT_BG_DEFAULT = 'bg-l-gray'

// bytes → 사람이 읽는 크기
export function fmtSize(bytes: number): string {
  if (!bytes || bytes < 0) return '0B'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
}

export { fmtDate } from '@/utils/date'

// 목록 상태 파서 — /drive 와 /drive/recent 가 같은 규칙을 쓴다.
// 두 라우트에 따로 두면 한쪽만 고쳐져 조용히 갈라진다.
export function parseDriveSearch(search: Record<string, unknown>): DriveRecentSearch {
  const page = Number(search.page)
  const limit = Number(search.limit)
  const sort = String(search.sort ?? '') as DriveSort
  return {
    sort: DRIVE_SORTS.includes(sort) && sort !== 'new' ? sort : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
    limit: LIMIT_OPTIONS.includes(limit) ? limit : undefined,
  }
}
