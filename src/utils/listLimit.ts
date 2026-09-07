// 목록 「개수(페이지당)」 규약 — 게시글 목록과 자료 목록이 **같은 값을 공유**한다.
// 레거시(jupiter-board-web)도 두 목록이 localStorage 'postLimit' 하나를 함께 쓴다.
// 그래서 도메인 constants 가 아니라 공용 util 에 둔다.

export const LIMIT_OPTIONS = [10, 20, 30, 40, 50]
export const LIMIT_DEFAULT_DESKTOP = 10
export const LIMIT_DEFAULT_MOBILE = 20
export const LIMIT_STORAGE_KEY = 'postLimit'
// 레거시 useWindowSize: windowWidth <= 630 이 모바일 (CSS 의 min-[631px] 경계와 같다)
export const MOBILE_MAX_WIDTH = 630

// 기기 폭 기준 기본 개수. 저장값·URL 이 없을 때의 최종 폴백.
export function deviceDefaultLimit(): number {
  return typeof window !== 'undefined' && window.innerWidth <= MOBILE_MAX_WIDTH
    ? LIMIT_DEFAULT_MOBILE
    : LIMIT_DEFAULT_DESKTOP
}

// localStorage 는 사생활 보호 모드 등에서 접근 자체가 throw 한다 → 조용히 무시한다.
export function readStoredLimit(): number | undefined {
  try {
    const n = Number(localStorage.getItem(LIMIT_STORAGE_KEY))
    return LIMIT_OPTIONS.includes(n) ? n : undefined
  } catch {
    return undefined
  }
}
export function writeStoredLimit(n: number): void {
  try {
    localStorage.setItem(LIMIT_STORAGE_KEY, String(n))
  } catch {
    /* 무시 */
  }
}
