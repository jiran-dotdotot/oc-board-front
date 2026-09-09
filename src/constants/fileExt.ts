// 확장자 → 파스텔 배경. 자료실·홈·게시글 첨부가 같은 파일을 같은 색으로 그려야 한다.
// ⚠ 이 위의 글자는 반드시 `text-on-pastel` — l-* 파스텔은 다크 오버라이드가 없다.
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

export function extBg(ext: string | undefined): string {
  return EXT_BG[(ext ?? '').toUpperCase()] ?? EXT_BG_DEFAULT
}
