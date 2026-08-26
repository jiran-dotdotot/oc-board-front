// 자료실(화면 07) — 통합 앱 기준 평면 목록. 목록은 API(GET /drive/file), 업로드/삭제/북마크는 로컬 데모.

export const ME_NAME = '김민준'

export const STORAGE = { used: '6.4GB', total: '10GB', pct: 64 }

export type FileState = 'idle' | 'up' | 'done'

export interface DriveFile {
  id: string | number
  name: string
  ext: string
  tagBg: string
  by: string
  mine: boolean
  date: string
  size: string
  bm?: boolean
  state: FileState
  pct?: number
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

// ISO datetime → 2026.08.03
export function fmtDate(s?: string | null): string {
  return s ? s.slice(0, 10).replace(/-/g, '.') : ''
}
