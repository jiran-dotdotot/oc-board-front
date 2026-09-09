import { previewKind } from '@/utils/filePreview'
import { describe, expect, it } from 'vitest'

describe('previewKind', () => {
  it('브라우저가 여는 형식만 미리보기로 분류한다', () => {
    expect(previewKind('png')).toBe('image')
    expect(previewKind('JPEG')).toBe('image')
    expect(previewKind('mp4')).toBe('video')
    expect(previewKind('pdf')).toBe('pdf')
  })

  it('한글·오피스·압축은 아직 none — 다운로드 안내로 보낸다', () => {
    for (const e of ['HWP', 'HWPX', 'DOCX', 'XLSX', 'PPTX', 'ZIP', 'JSON']) {
      expect(previewKind(e)).toBe('none')
    }
  })

  it('빈 확장자도 안전하게 none', () => {
    expect(previewKind('')).toBe('none')
  })
})
