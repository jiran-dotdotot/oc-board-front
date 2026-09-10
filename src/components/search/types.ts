import type {
  PERIOD_OPTIONS,
  SEARCH_ORDERS,
  SEARCH_TABS,
  SEARCH_TARGET_KEYS,
  TARGET_OPTIONS,
} from './constants'

export type SearchTab = (typeof SEARCH_TABS)[number]
/** URL 에 실리는 검색 대상. 「전체」는 undefined 로 생략된다. */
export type SearchTargetKey = (typeof SEARCH_TARGET_KEYS)[number]
/** 화면이 다루는 검색 대상(전체 포함). */
export type SearchTarget = (typeof TARGET_OPTIONS)[number]['value']
export type SearchOrder = (typeof SEARCH_ORDERS)[number]
export type PeriodPreset = (typeof PERIOD_OPTIONS)[number]['value']

/**
 * `/search` 의 URL 쿼리 = 화면 상태의 정본(공유·새로고침·뒤로가기).
 * 기본값은 URL 에 쓰지 않는다(undefined) — 화면이 채운다.
 *
 * 레거시의 키 이름을 그대로 쓰지 않는다: `selectedTypeScope`(초기 조회)와 `type`(탭·페이징)이
 * 두 정본으로 갈라져 서로 어긋나 있었다(jupiter-board-web `search.vue:143` vs `:73`).
 */
export interface SearchQuery {
  /** 검색어. */
  q?: string
  /** 결과 탭. 'posts' 는 기본값이라 생략. */
  tab?: SearchTab
  /** 검색 대상. 생략 = 전체(Go `search`). */
  target?: SearchTargetKey
  /** 게시판 UUID · 카테고리 UUID(`cat=1`) · 'public' · 'all'. */
  board?: string
  /** 1이면 `board` 가 카테고리 id 다. */
  cat?: 1
  /** 작성자 이름(ILIKE). */
  writer?: string
  /** 기간 하한/상한 — `YYYY-MM-DD`. */
  from?: string
  to?: string
  /** 1이면 살아있는 댓글까지 확장(Go `is_include_comment`). */
  comment?: 1
  /** 1이면 상세 필터를 펼친 채로 연다. */
  filter?: 1
  /** 정렬. 'relative' 는 기본값이라 생략. */
  order?: SearchOrder
  /** 페이지. 1 은 생략. */
  page?: number
}

/** 상세 필터 초안 — 「적용」을 누르기 전까지 URL 에 반영되지 않는 조각. */
export type FilterDraft = Pick<
  SearchQuery,
  'target' | 'board' | 'cat' | 'writer' | 'from' | 'to' | 'comment'
>
