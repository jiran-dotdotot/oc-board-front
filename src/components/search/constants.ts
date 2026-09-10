// 통합 검색 도메인 상수. 인라인 리터럴 금지 규약 — 화면은 여기서만 값을 읽는다.

/**
 * 검색어 최소 길이. Go 는 이 아래를 «조용히» 다르게 처리한다:
 * `search` 1자는 200 이지만 필터가 빠져 **전체 목록**이 나오고(05:275),
 * `title`/`content` 1자는 400 INVALID_PAYLOAD 다(05:277-278 · 09:135).
 * 그래서 요청 자체를 프론트에서 막는다.
 */
export const MIN_QUERY_LEN = 2

/**
 * 최근 검색어는 localStorage 가 정본이다. 서버 쓰기(PUT recent-search-keywords)는
 * member 토큰 전용이라 이 앱(board 토큰)에서 401 이다 — 실측, BR-012.
 * 키 이름은 레거시(jupiter-board-web)와 같다.
 */
export const RECENT_KEY = 'searchWords'
/** 서버 저장 상한(01-auth-user.md:171 「최대 8개」)과 같은 값으로 맞춘다. */
export const RECENT_MAX = 8

export const SEARCH_TABS = ['posts', 'files'] as const
/** URL 에는 title·content 만 실린다 — 「전체」는 기본값이라 생략한다. */
export const SEARCH_TARGET_KEYS = ['title', 'content'] as const
export const SEARCH_ORDERS = ['relative', 'new'] as const

/** 「전체 게시판」·「공용 게시판 전체」는 UUID 가 아닌 예약값이다. */
export const BOARD_ALL = 'all'
export const BOARD_PUBLIC = 'public'

/** 검색 대상 칩 — 「전체」는 Go `search`(제목·평문·**작성자** OR)로 간다. */
export const TARGET_OPTIONS = [
  { value: 'all', key: 'search-target-all' },
  { value: 'title', key: 'search-target-title' },
  { value: 'content', key: 'search-target-content' },
] as const

/**
 * 기간 프리셋. URL 에는 from/to 만 실리고 칩 선택은 그 값에서 역산한다.
 * 정본(통합 앱)은 칩 4개 + 직접입력이고 「1년」이 없다 — 레거시 데스크톱에만 있던 옵션이며
 * 직접입력으로 도달할 수 있어 뺐다. 「전체」는 기간만 개별로 끄는 유일한 경로라 남긴다.
 */
export const PERIOD_OPTIONS = [
  { value: 'all', key: 'search-preset-all' },
  { value: '1w', key: 'search-preset-1w' },
  { value: '1m', key: 'search-preset-1m' },
  { value: '3m', key: 'search-preset-3m' },
  { value: '6m', key: 'search-preset-6m' },
  { value: 'custom', key: 'search-preset-custom' },
] as const

export const SORT_OPTIONS = [
  { value: 'relative', key: 'search-sort-relative' },
  { value: 'new', key: 'search-sort-new' },
] as const
