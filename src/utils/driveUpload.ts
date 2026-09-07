// 자료실 업로드 사전 검증. 서버(presign)가 같은 검사를 하지만, 거기서 걸리면
// 파일마다 fail 이 흩어져 돌아오므로 고르는 시점에 한 번에 알려 준다.

/** 다중 presign 은 파일 배열이 11개 이상이면 400 (docs/api/10 §2). */
export const MAX_UPLOAD_FILES = 10

/** size_limit_per_file 이 0 이하면 서버 전역 상한 MAX_FILE_SIZE 를 쓴다. */
export const MAX_FILE_SIZE = 3 * 1024 * 1024 * 1024

export interface UploadLimits {
  /** board.except_extension — 서버가 «대문자» 배열로 준다. */
  exceptExtension: string[]
  /** board.size_limit_per_file. 0 이하면 무제한(= 전역 3GiB). */
  sizeLimitPerFile: number
  /** board.size_limit. 0 이하면 무제한. */
  sizeLimit: number
  /** board.total_usage_size — 이미 쓴 용량. */
  usedSize: number
}

export type UploadReject =
  | { code: 'extension'; names: string[] }
  | { code: 'perFile'; names: string[] }
  | { code: 'quota' }
  | { code: 'count' }

/** «표시용» 확장자. 점 없는 이름·도트파일은 확장자가 없다고 본다(확장자 칩·미리보기 판정용). */
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1) : ''
}

/**
 * presign 에 보내는 확장자. `files[].extension` 은 **필수**라 빈 문자열을 보내면
 * body 검증에서 400 이 나고 «묶음 전체»가 죽는다(docs/api/10-…:100,116).
 * 레거시와 같은 규칙을 쓴다 — `substring(lastIndexOf('.') + 1)`:
 *   `Makefile` → 'Makefile' · `.env` → 'env' · `a.tar.gz` → 'gz'
 * 사전검증(금지 확장자)도 «반드시 이 값»으로 해야 서버 판정과 갈리지 않는다.
 */
export function uploadExtension(name: string): string {
  return name.substring(name.lastIndexOf('.') + 1)
}

/**
 * 고른 묶음을 검사한다. 레거시와 같이 **한 건이라도 걸리면 묶음 전체를 거부**한다
 * (일부만 담으면 사용자가 무엇이 빠졌는지 모른 채 등록해 버린다).
 * @param staged 이미 목록에 담겨 있는 파일들 — 개수·용량 상한을 «합계»로 본다.
 */
export function validateUpload(
  files: File[],
  limits: UploadLimits,
  staged: File[] = [],
): UploadReject | null {
  if (staged.length + files.length > MAX_UPLOAD_FILES) return { code: 'count' }

  const banned = new Set(limits.exceptExtension.map((e) => e.toUpperCase()))
  // 서버는 우리가 보낸 extension 을 except_extension 과 비교한다 → 같은 값으로 검사해야 한다.
  const badExt = files.filter((f) => banned.has(uploadExtension(f.name).toUpperCase()))
  if (badExt.length > 0) return { code: 'extension', names: badExt.map((f) => f.name) }

  const perFile = limits.sizeLimitPerFile > 0 ? limits.sizeLimitPerFile : MAX_FILE_SIZE
  const tooBig = files.filter((f) => f.size > perFile)
  if (tooBig.length > 0) return { code: 'perFile', names: tooBig.map((f) => f.name) }

  if (limits.sizeLimit > 0) {
    // 이미 담아 둔 것까지 합쳐야 한다 — 나눠서 고르면 상한을 넘겨도 통과해 버린다.
    const total = [...staged, ...files].reduce((a, f) => a + f.size, 0)
    if (limits.sizeLimit - limits.usedSize < total) return { code: 'quota' }
  }
  return null
}

export type UploadErrorKey =
  'drive-up-err-extension' | 'drive-up-err-per-file' | 'drive-up-err-quota' | 'drive-up-err-unknown'

/** presign 이 fail 로 준 message 키 → i18n 키. 서버가 번역 없이 키 문자열을 내려보낸다. */
export function presignFailKey(message: string): UploadErrorKey {
  switch (message) {
    case 'not_allow_extension':
      return 'drive-up-err-extension'
    case 'exceeded_size_per_file':
      return 'drive-up-err-per-file'
    case 'not_enough_drive_capacity':
      return 'drive-up-err-quota'
    default:
      return 'drive-up-err-unknown'
  }
}

/** 아이폰 기본 포맷. 브라우저가 못 열어 업로드 전에 jpeg 로 바꾼다. */
export const HEIC_EXTENSIONS = ['HEIC', 'HEIF']

export function isHeic(file: File): boolean {
  return HEIC_EXTENSIONS.includes(fileExtension(file.name).toUpperCase())
}

/** `사진.heic` → `사진.jpg` (확장자가 없으면 뒤에 붙인다). */
export function toJpegName(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? `${name.slice(0, dot)}.jpg` : `${name}.jpg`
}

/**
 * HEIC/HEIF 만 jpeg 로 변환한다. 변환기는 무겁고 아이폰 사진에만 필요해 **지연 로드**한다.
 * 변환에 실패하면 원본을 그대로 돌려준다 — 업로드 자체를 막지는 않는다(서버가 받아 주긴 한다).
 */
export async function convertHeicFiles(files: File[]): Promise<File[]> {
  if (!files.some(isHeic)) return files
  const { default: heic2any } = await import('heic2any')
  return Promise.all(
    files.map(async (f) => {
      if (!isHeic(f)) return f
      try {
        const out = await heic2any({ blob: f, toType: 'image/jpeg', quality: 0.7 })
        const blob = Array.isArray(out) ? out[0] : out
        return new File([blob], toJpegName(f.name), { type: 'image/jpeg' })
      } catch {
        return f
      }
    }),
  )
}
