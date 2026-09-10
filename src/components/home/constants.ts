// 홈 화면 상수 (최근 게시글/자료는 API로 조회 — RECENT_* 데모 데이터 제거됨)

// 홈 최근 게시글·최근 자료에 각각 노출할 개수 (게시글 take / 자료 limit).
export const HOME_TAKE = 8

// 해야 할 일 칩 — 디자인은 파스텔 채움이 아니라 중립 아웃라인 pill이다.
export const TODO_PILL =
  'inline-flex h-8 flex-none items-center gap-1.5 rounded-[20px] border border-gray-200 bg-card px-3 text-[12.5px] font-semibold whitespace-nowrap text-gray-700 hover:bg-gray-100'

// 확장자 파스텔 표는 단일 출처다 — 세 화면(자료실·홈·게시글 첨부)이 같은 색을 써야 한다.
export { EXT_BG, EXT_BG_DEFAULT } from '@/constants/fileExt'
