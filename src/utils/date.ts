// 날짜 포맷 — 정본: YYYY.MM.DD, 전 화면 공통 (docs/guides/design-tokens-guide.md §공통 규칙).
// 같은 로직이 홈·게시판·자료실에 각각 복제돼 있던 것을 여기로 모았다.

/** ISO datetime(`2026-08-03T09:00:00`) → `2026.08.03`. 값이 없으면 빈 문자열. */
export function fmtDate(s?: string | null): string {
  return s ? s.slice(0, 10).replace(/-/g, '.') : ''
}

/**
 * ISO datetime → `2026.08.03 14:32` (정본 `{{ dDateTime }}` 자리).
 *
 * 서버는 `2026-08-26T10:00:00.000000Z` 처럼 **UTC 표기**로 주기도 한다(docs/api/07 예시).
 * 그럴 때 문자열을 자르면 9시간 어긋난 시각이 뜨므로 Date 로 파싱해 현지 시각으로 만든다.
 * 오프셋 표기가 없는 값(이미 앱 타임존)은 fmtDate 와 같은 «자르기» 규약을 유지한다.
 */
export function fmtDateTime(s?: string | null): string {
  if (!s) return ''
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/.test(s)
  if (!zoned) return `${fmtDate(s)} ${s.slice(11, 16)}`.trim()
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
