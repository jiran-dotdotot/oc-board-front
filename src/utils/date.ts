// 날짜 포맷 — 정본: YYYY.MM.DD, 전 화면 공통 (docs/guides/design-tokens-guide.md §공통 규칙).
// 같은 로직이 홈·게시판·자료실에 각각 복제돼 있던 것을 여기로 모았다.

/** ISO datetime(`2026-08-03T09:00:00`) → `2026.08.03`. 값이 없으면 빈 문자열. */
export function fmtDate(s?: string | null): string {
  return s ? s.slice(0, 10).replace(/-/g, '.') : ''
}
