// URL 쿼리 ↔ Go 요청 파라미터 변환. 전부 순수함수다(단위 테스트 대상).
//
// ⚠ 탭마다 **별개의 객체**를 만든다. 레거시는 파라미터 객체 하나를 게시글·자료 스토어에
//   함께 넘겨, 자료 스토어가 `sort[by]` 를 덮어쓰면 axios 직렬화 전이라 게시글 요청까지
//   오염됐다(jupiter-board-web `search.vue:158-160` + `stores/drive.ts:188-190`).
import {
  BOARD_ALL,
  BOARD_PUBLIC,
  MIN_QUERY_LEN,
  SEARCH_ORDERS,
  SEARCH_TARGET_KEYS,
} from './constants'
import type {
  FilterDraft,
  PeriodPreset,
  SearchOrder,
  SearchQuery,
  SearchTab,
  SearchTargetKey,
} from './types'
import type { DriveFileListParams } from '@/types/drive'
import type { PostListParams } from '@/types/post'

const pad = (n: number) => String(n).padStart(2, '0')

/** Date → `YYYY-MM-DD` (현지 기준). */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** TanStack Router `validateSearch` 본체. 알 수 없는 값은 기본값(생략)으로 떨어뜨린다. */
export function parseSearchQuery(search: Record<string, unknown>): SearchQuery {
  const tab = String(search.tab ?? '') as SearchTab
  const target = String(search.target ?? '') as SearchTargetKey
  const order = String(search.order ?? '') as SearchOrder
  const page = Number(search.page)
  const from = String(search.from ?? '')
  const to = String(search.to ?? '')
  const q = typeof search.q === 'string' ? search.q : ''
  const writer = typeof search.writer === 'string' ? search.writer.trim() : ''
  const board = typeof search.board === 'string' ? search.board.trim() : ''
  return {
    q: q || undefined,
    tab: tab === 'files' ? 'files' : undefined,
    target: (SEARCH_TARGET_KEYS as readonly string[]).includes(target) ? target : undefined,
    board: board || undefined,
    cat: search.cat === '1' || search.cat === 1 ? 1 : undefined,
    writer: writer || undefined,
    from: DATE_RE.test(from) ? from : undefined,
    to: DATE_RE.test(to) ? to : undefined,
    comment: search.comment === '1' || search.comment === 1 ? 1 : undefined,
    filter: search.filter === '1' || search.filter === 1 ? 1 : undefined,
    order:
      (SEARCH_ORDERS as readonly string[]).includes(order) && order !== 'relative'
        ? order
        : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
  }
}

/** 프리셋 → 기간. 「전체」·「직접입력」은 스스로 날짜를 정하지 않는다. */
export function rangeOf(preset: PeriodPreset, today: Date): { from?: string; to?: string } {
  if (preset === 'all' || preset === 'custom') return {}
  const from = new Date(today)
  if (preset === '1w') from.setDate(from.getDate() - 7)
  else from.setMonth(from.getMonth() - Number(preset.replace('m', '')))
  return { from: ymd(from), to: ymd(today) }
}

/**
 * 기간 → 프리셋 역산. 레거시도 URL 복원 시 dayjs diff 로 같은 일을 한다
 * (`SearchInput.vue:376-390`). 어느 프리셋과도 안 맞으면 「직접입력」이다.
 */
export function presetOf(
  from: string | undefined,
  to: string | undefined,
  today: Date,
): PeriodPreset {
  if (!from || !to) return 'all'
  for (const p of ['1w', '1m', '3m', '6m'] as const) {
    const r = rangeOf(p, today)
    if (r.from === from && r.to === to) return p
  }
  return 'custom'
}

/** 필터 버튼 배지에 띄우는 «적용된 조건» 개수. */
export function activeFilterCount(s: SearchQuery): number {
  let n = 0
  if (s.target) n++
  if (s.board && s.board !== BOARD_ALL) n++
  if (s.writer) n++
  if (s.from && s.to) n++
  if (s.comment) n++
  return n
}

/** 검색을 실행할 수 있는가. Go 의 1자 처리가 탭마다 다르므로 요청 전에 막는다. */
export function isQueryReady(q: string | undefined): boolean {
  return (q ?? '').trim().length >= MIN_QUERY_LEN
}

/** 게시판·카테고리·공용 범위 — 게시글·자료가 같은 규칙을 쓴다. */
function scopeOf(s: SearchQuery) {
  if (!s.board || s.board === BOARD_ALL) return {}
  if (s.board === BOARD_PUBLIC) return { is_public_only: true }
  return s.cat ? { category_id: s.board } : { board_id: s.board }
}

/**
 * 기간을 Go 파라미터로. 날짜만 보내면 종료값이 «그날 자정»이라 종료일 하루가 통째로
 * 빠진다(09-drive-file.md:140) → 레거시와 같이 시각을 붙인다.
 */
function periodOf(s: SearchQuery) {
  return {
    start_posted_at: s.from ? `${s.from} 00:00:00` : undefined,
    end_posted_at: s.to ? `${s.to} 23:59:59` : undefined,
  }
}

export function buildPostParams(s: SearchQuery, take: number, page: number): PostListParams {
  const q = (s.q ?? '').trim()
  return {
    // 「전체」는 title_content 가 아니라 search 다 — search 는 제목·평문에 **작성자**까지
    // OR 로 묶어 상위집합이다(05:275 vs :276).
    search: s.target ? undefined : q,
    title: s.target === 'title' ? q : undefined,
    content: s.target === 'content' ? q : undefined,
    // Go: is_include_comment 는 title/content/title_content 만 확장하고 search 에는 무관(05:279).
    is_include_comment: s.comment && s.target ? true : undefined,
    user_name: s.writer,
    ...scopeOf(s),
    ...periodOf(s),
    take,
    page,
    sort:
      s.order === 'new'
        ? { by: 'posted_at', order: 'desc' }
        : { by: 'relative', order: 'desc', value: q },
  }
}

/**
 * 자료 탭 파라미터. 「본문」 검색은 파일에 본문이 없어 **조회하지 않는다**(null) —
 * 레거시도 `selectedContentScope==='content'` 이면 files 를 비운다(`search.vue:154`).
 *
 * ⚠ `is_only_file_search` 를 보내지 않는다. 그건 서버측 최근검색어 저장 스위치인데
 *   (09:132) 최근검색어는 로컬이 정본이다. `is_not_paging` 도 보내지 않는다(BR-032).
 */
export function buildFileParams(
  s: SearchQuery,
  take: number,
  page: number,
): DriveFileListParams | null {
  if (s.target === 'content') return null
  const q = (s.q ?? '').trim()
  return {
    // 생략 시 search = 원본 파일명 **또는 업로더 이름**, 지정 시 title = 파일명만(09:134-135).
    search: s.target ? undefined : q,
    title: s.target === 'title' ? q : undefined,
    user_name: s.writer,
    ...scopeOf(s),
    ...periodOf(s),
    take,
    page,
    // 자료실의 relative 는 본문 관련도가 아니라 «파일명 분할 수»다(09:149).
    sort:
      s.order === 'new'
        ? { by: 'created_at', order: 'desc' }
        : { by: 'relative', order: 'desc', value: q },
  }
}

/** URL 쿼리에서 필터 7키만 뽑는다. 빈 객체를 넘기면 «전부 지우는» 패치가 된다. */
export function draftOf(s: SearchQuery): FilterDraft {
  return {
    target: s.target,
    board: s.board,
    cat: s.cat,
    writer: s.writer,
    from: s.from,
    to: s.to,
    comment: s.comment,
  }
}
