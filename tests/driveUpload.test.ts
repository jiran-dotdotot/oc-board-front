import {
  MAX_FILE_SIZE,
  type UploadLimits,
  convertHeicFiles,
  fileExtension,
  isHeic,
  presignFailKey,
  toJpegName,
  uploadExtension,
  validateUpload,
} from '@/utils/driveUpload'
import { describe, expect, it } from 'vitest'

// happy-dom 의 File 은 size 가 읽기전용이라 정의를 덮어써서 원하는 크기를 만든다.
const sized = (name: string, size: number): File => {
  const f = new File([''], name)
  Object.defineProperty(f, 'size', { value: size })
  return f
}

const open: UploadLimits = {
  exceptExtension: [],
  sizeLimitPerFile: 0,
  sizeLimit: 0,
  usedSize: 0,
}

describe('fileExtension', () => {
  it('마지막 점 뒤만 확장자다', () => {
    expect(fileExtension('a.tar.gz')).toBe('gz')
  })
  it('점이 없으면 빈 문자열', () => {
    expect(fileExtension('README')).toBe('')
  })
  it('숨김 파일의 점은 확장자가 아니다', () => {
    expect(fileExtension('.env')).toBe('')
  })
})

describe('validateUpload', () => {
  it('제한이 없으면 통과한다', () => {
    expect(validateUpload([sized('a.pdf', 10)], open)).toBeNull()
  })

  it('금지 확장자는 대소문자를 무시한다', () => {
    const r = validateUpload([sized('bad.EXE', 10)], { ...open, exceptExtension: ['exe'] })
    expect(r).toEqual({ code: 'extension', names: ['bad.EXE'] })
  })

  it('파일당 상한을 넘으면 거부한다', () => {
    const r = validateUpload([sized('big.zip', 200)], { ...open, sizeLimitPerFile: 100 })
    expect(r).toEqual({ code: 'perFile', names: ['big.zip'] })
  })

  it('파일당 상한이 0 이하면 전역 3GiB 를 쓴다', () => {
    expect(validateUpload([sized('ok.bin', MAX_FILE_SIZE)], open)).toBeNull()
    expect(validateUpload([sized('no.bin', MAX_FILE_SIZE + 1)], open)).toEqual({
      code: 'perFile',
      names: ['no.bin'],
    })
  })

  it('size_limit 이 음수(-1)면 무제한으로 본다', () => {
    const r = validateUpload([sized('a.pdf', 999)], { ...open, sizeLimit: -1, usedSize: 500 })
    expect(r).toBeNull()
  })

  it('잔여 용량보다 합계가 크면 거부한다', () => {
    const limits = { ...open, sizeLimit: 1000, usedSize: 900 }
    expect(validateUpload([sized('a', 50), sized('b', 60)], limits)).toEqual({ code: 'quota' })
    expect(validateUpload([sized('a', 50), sized('b', 50)], limits)).toBeNull()
  })

  it('이미 담긴 개수를 합쳐 10개를 넘으면 거부한다', () => {
    const files = Array.from({ length: 3 }, (_, i) => sized(`f${i}`, 1))
    const staged8 = Array.from({ length: 8 }, (_, i) => sized(`s${i}`, 1))
    expect(validateUpload(files, open, staged8)).toEqual({ code: 'count' })
    expect(validateUpload(files, open, staged8.slice(0, 7))).toBeNull()
  })

  it('이미 담긴 «크기»도 합쳐 잔여 용량을 본다', () => {
    // 회귀: staged 크기를 빼먹으면 나눠 고르는 것만으로 상한을 넘길 수 있었다
    const limits = { ...open, sizeLimit: 1000, usedSize: 0 }
    const staged = [sized('a', 600)]
    expect(validateUpload([sized('b', 500)], limits, staged)).toEqual({ code: 'quota' })
    expect(validateUpload([sized('b', 400)], limits, staged)).toBeNull()
  })

  it('한 건이라도 걸리면 묶음 전체를 거부한다(부분 통과 없음)', () => {
    const r = validateUpload([sized('ok.pdf', 1), sized('bad.exe', 1)], {
      ...open,
      exceptExtension: ['EXE'],
    })
    expect(r).toEqual({ code: 'extension', names: ['bad.exe'] })
  })
})

describe('presignFailKey — 서버가 번역 없이 키를 내려보낸다', () => {
  it('문서에 있는 3가지를 매핑한다', () => {
    expect(presignFailKey('not_allow_extension')).toBe('drive-up-err-extension')
    expect(presignFailKey('exceeded_size_per_file')).toBe('drive-up-err-per-file')
    expect(presignFailKey('not_enough_drive_capacity')).toBe('drive-up-err-quota')
  })
  it('모르는 값은 unknown 으로 떨어진다', () => {
    expect(presignFailKey('something_else')).toBe('drive-up-err-unknown')
    expect(presignFailKey('')).toBe('drive-up-err-unknown')
  })
})

describe('확장자 — 표시용과 presign 용이 다르다', () => {
  it('표시용은 점 없는 이름·도트파일을 «확장자 없음»으로 본다', () => {
    expect(fileExtension('Makefile')).toBe('')
    expect(fileExtension('.env')).toBe('')
    expect(fileExtension('a.tar.gz')).toBe('gz')
  })

  it('presign 용은 «절대 빈 문자열이 아니다» — 빈 값은 필수 검증 400 으로 묶음 전체를 죽인다', () => {
    // 회귀: fileExtension 을 그대로 보내 Makefile 이 extension:"" 으로 나갔다
    expect(uploadExtension('Makefile')).toBe('Makefile')
    expect(uploadExtension('LICENSE')).toBe('LICENSE')
    expect(uploadExtension('.env')).toBe('env')
    expect(uploadExtension('a.tar.gz')).toBe('gz')
    for (const n of ['Makefile', 'LICENSE', '.env', 'a.pdf']) {
      expect(uploadExtension(n)).not.toBe('')
    }
  })

  it('금지 확장자 검사는 presign 용 값을 쓴다 — 서버와 같은 값으로 비교해야 한다', () => {
    const r = validateUpload([sized('.env', 1)], { ...open, exceptExtension: ['ENV'] })
    expect(r).toEqual({ code: 'extension', names: ['.env'] })
  })
})

describe('HEIC 변환 대상 판정', () => {
  it('heic·heif 만 대상이다(대소문자 무시)', () => {
    expect(isHeic(sized('photo.HEIC', 1))).toBe(true)
    expect(isHeic(sized('photo.heif', 1))).toBe(true)
    expect(isHeic(sized('photo.jpg', 1))).toBe(false)
    expect(isHeic(sized('heic', 1))).toBe(false)
  })

  it('확장자만 jpg 로 바꾼다', () => {
    expect(toJpegName('IMG_0001.HEIC')).toBe('IMG_0001.jpg')
    expect(toJpegName('a.b.heic')).toBe('a.b.jpg')
    expect(toJpegName('noext')).toBe('noext.jpg')
  })

  it('HEIC 가 없으면 변환기를 불러오지 않고 원본 배열을 그대로 준다', async () => {
    const files = [sized('a.png', 1), sized('b.pdf', 1)]
    await expect(convertHeicFiles(files)).resolves.toBe(files)
  })
})
