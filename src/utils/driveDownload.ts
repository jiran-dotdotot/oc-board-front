// 자료실·게시글 첨부 다운로드. Go 는 파일 DTO 에 src/object_key 를 주지 않고
// `…/download-url`(5분 presign)을 따로 발급한다 — 클라이언트가 공개 S3 주소를
// 조립하지 않는다(docs/api/go/09-drive-file.md:185, 05-post-read.md:45).
// 여러 건은 브라우저에서 zip 으로 묶는다.

// ponytail: 동시 6개 — 브라우저 커넥션 한계에 맞춘 값. 레거시는 무제한 병렬이라 50개 선택 시 50요청이었다.
export const DOWNLOAD_CONCURRENCY = 6

/** 어느 다운로드 엔드포인트를 쓸지. 자료실 파일과 게시글 첨부는 «다른» 경로다. */
export type S3Scope = 'drive' | 'post'

// zip 안에서 같은 이름이 겹치지 않게 `이름 (1).pdf` 로 번호를 붙인다(레거시 getUniqueFileNames).
export function uniqueFileNames(names: string[]): string[] {
  // ⚠ 만들어 낸 이름도 taken 에 넣어야 한다 — 목록에 이미 `a (1).pdf` 가 있는데
  //   `a.pdf` 중복 때문에 같은 이름을 또 만들면 JSZip 이 조용히 덮어써 항목이 사라진다.
  const taken = new Set<string>()
  const nth = new Map<string, number>()
  return names.map((name) => {
    if (!taken.has(name)) {
      taken.add(name)
      return name
    }
    const dot = name.lastIndexOf('.')
    const stem = dot > 0 ? name.slice(0, dot) : name
    const ext = dot > 0 ? name.slice(dot) : ''
    // 이미 `이름 (3)` 형태면 그 번호를 벗겨 내고 다시 센다 — 안 벗기면 `a (1) (1).pdf` 가 된다.
    const base = stem.replace(/ \(\d+\)$/, '')
    const key = base + ext
    let n = (nth.get(key) ?? 0) + 1
    let candidate = `${base} (${n})${ext}`
    while (taken.has(candidate)) {
      n += 1
      candidate = `${base} (${n})${ext}`
    }
    nth.set(key, n)
    taken.add(candidate)
    return candidate
  })
}

// 브라우저에 파일로 넘긴다. blob: URL 은 반드시 회수한다(안 하면 탭이 blob 을 붙들고 있는다).
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** 동시 실행 수를 제한하며 순서대로 결과를 채운다. 하나라도 실패하면 그 에러를 던진다. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let cursor = 0
  const worker = async () => {
    for (;;) {
      const i = cursor++
      if (i >= items.length) return
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}
