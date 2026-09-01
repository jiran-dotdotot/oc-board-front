import type { Post } from './types'

// 공지 배너 자동 순환 주기(ms). 디자인엔 자동 순환 규정이 없어 정한 값 —
// 제목 한 줄을 읽고 넘어가기에 충분한 간격. hover/포커스·모달 열림·prefers-reduced-motion
// 이면 멈추고, 수동으로 넘기면 타이머가 처음부터 다시 돈다.
// 공지 상단 고정 상한 (디자인 「공지 초과 표시 시안」 6a — CAP=3).
// 초과분은 「숨은 공지 N건 모두 보기」 토글로 펼친다. 공지는 페이지네이션 카운트에서 분리된다.
export const NOTICE_TOP_CAP = 3

// 페이지당 개수 — 레거시(jupiter-board-web) 값 그대로.
// 기본값이 기기별로 다르고 선택은 localStorage 에 남는다(키도 레거시와 동일 → 이관 시 유지됨).
export const LIMIT_OPTIONS = [10, 20, 30, 40, 50]
export const LIMIT_DEFAULT_DESKTOP = 10
export const LIMIT_DEFAULT_MOBILE = 20
export const LIMIT_STORAGE_KEY = 'postLimit'
// 레거시 useWindowSize: windowWidth <= 630 이 모바일 (CSS 의 min-[631px] 경계와 같다)
export const MOBILE_MAX_WIDTH = 630

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

// 백엔드 연동 전 데모용 샘플 데이터. (실서비스에서는 apiClient + useQuery로 대체)
export const SAMPLE_POSTS: Post[] = [
  { id: 1, title: '첫 번째 공지사항', author: '관리자', createdAt: '2026-08-01' },
  { id: 2, title: '게시판 리뉴얼 안내', author: '관리자', createdAt: '2026-08-05' },
  { id: 3, title: '자유게시판이 열렸습니다', author: 'OC', createdAt: '2026-08-10' },
]
