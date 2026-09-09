// 미리보기 가능 여부. «지금은 브라우저가 기본으로 여는 형식만» 연다.
// 한글(HWP)·오피스는 뷰어가 따로 필요해 추후 확장한다 — 그때까지는 다운로드 안내로 보낸다.
export type PreviewKind = 'image' | 'video' | 'pdf' | 'none'

const IMAGE = ['PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'BMP', 'SVG', 'AVIF']
const VIDEO = ['MP4', 'WEBM', 'OGG', 'MOV', 'M4V']

export function previewKind(ext: string): PreviewKind {
  const e = (ext ?? '').toUpperCase()
  if (IMAGE.includes(e)) return 'image'
  if (VIDEO.includes(e)) return 'video'
  if (e === 'PDF') return 'pdf'
  return 'none'
}
