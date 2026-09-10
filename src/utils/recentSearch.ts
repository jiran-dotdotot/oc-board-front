// 최근 검색어 저장소 — localStorage 가 정본이다.
//
// 서버 쪽 계약은 «읽기만» 쓸 수 있다: GET /board/me 의 company_user_setting.recent_search_keyword
// 는 board 토큰으로 읽히지만(01-auth-user.md:165), 전체 교체 PUT 은 member 토큰 전용이라
// 이 앱에서 401 이다(02-management.md:373 · 실측 BR-012). 개별 삭제·전체 삭제를 서버에
// 반영할 방법이 없어 로컬을 정본으로 두고 서버값은 최초 1회 시드로만 쓴다.
import { RECENT_KEY, RECENT_MAX } from '@/components/search/constants'

/** 저장된 목록. 키가 아예 없으면 null(= 아직 시드 전) — 빈 배열과 구분해야 한다. */
export function readRecents(): string[] | null {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    // 레거시는 실패한 서버 응답을 그대로 넣어 "undefined" 문자열을 저장한 적이 있다
    // (jupiter-board-web stores/search.ts:41) → 모양을 확인하고 받는다.
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : null
  } catch {
    // 사생활 보호 모드 등에서 접근 자체가 throw 한다.
    return null
  }
}

export function writeRecents(list: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    /* 무시 */
  }
}

/** 중복은 맨 위로 올리고 상한을 넘으면 오래된 것을 버린다(레거시와 같은 규약). */
export function addRecent(list: string[], word: string): string[] {
  const w = word.trim()
  if (!w) return list
  return [w, ...list.filter((x) => x !== w)].slice(0, RECENT_MAX)
}
