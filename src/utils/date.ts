// 날짜 포맷 — 정본: YYYY.MM.DD, 전 화면 공통 (docs/guides/design-tokens-guide.md §공통 규칙).
// 같은 로직이 홈·게시판·자료실에 각각 복제돼 있던 것을 여기로 모았다.

/**
 * ISO datetime → 현지 기준 `['2026.08.03', '14:32']`.
 *
 * 서버는 `2026-08-26T10:00:00.000000Z` 처럼 **UTC 표기**로 준다
 * (docs/api/go/05-post-read.md:188 「created_at/posted_at · UTC」).
 * 문자열을 자르면 9시간 어긋나 «목록과 상세의 날짜가 하루 달라진다» — 그래서 날짜만 쓰는
 * fmtDate 도 이 파서를 거친다. 오프셋 표기가 없는 값은 이미 앱 타임존으로 보고 자른다.
 */
function parts(s: string): [string, string] {
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(s))
    return [s.slice(0, 10).replace(/-/g, '.'), s.slice(11, 16)]
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ['', '']
  const p = (n: number) => String(n).padStart(2, '0')
  return [
    `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`,
    `${p(d.getHours())}:${p(d.getMinutes())}`,
  ]
}

/** ISO datetime → `2026.08.03`. 값이 없으면 빈 문자열. */
export function fmtDate(s?: string | null): string {
  return s ? parts(s)[0] : ''
}

/** ISO datetime → `2026.08.03 14:32` (정본 `{{ dDateTime }}` 자리). */
export function fmtDateTime(s?: string | null): string {
  if (!s) return ''
  return `${parts(s)[0]} ${parts(s)[1]}`.trim()
}
