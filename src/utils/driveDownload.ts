// 자료실 다운로드. 서버에 다운로드 라우트가 없어(getTemporaryUrl 미등록 — docs/api/09-drive-file.md:317)
// 레거시와 같이 공개 S3 오브젝트를 직접 GET 한다. 여러 건은 브라우저에서 zip 으로 묶는다.

// ponytail: 동시 6개 — 브라우저 커넥션 한계에 맞춘 값. 레거시는 무제한 병렬이라 50개 선택 시 50요청이었다.
export const DOWNLOAD_CONCURRENCY = 6

export function s3BaseUrl(): string | undefined {
  const base = import.meta.env.VITE_S3_FILE_BASE_URL
  return typeof base === 'string' && base ? base : undefined
}

export function s3FileUrl(base: string, src: string): string {
  return `${base.replace(/\/$/, '')}/${src.replace(/^\//, '')}`
}

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
