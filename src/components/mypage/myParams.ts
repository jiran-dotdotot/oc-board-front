// 내 활동(화면 08) 칩·탭 → Go 요청 매핑. **순수 함수만** 둔다 — 화면과 테스트가 같은 걸 본다.
// 계약: docs/api/go/05-post-read.md:332·389 · 09-drive-file.md:233·289
import type { DriveQueryState, MyDriveFileListParams } from '@/types/drive'
import type { MyPostListParams, PostQueryState } from '@/types/post'

export type ChipKey = 'important' | 'my' | 'draft' | 'schedule' | 'trash'
export type MyTab = 'post' | 'file'

export const CHIP_ORDER: ChipKey[] = ['important', 'my', 'draft', 'schedule', 'trash']
export const MY_TABS: MyTab[] = ['post', 'file']

/**
 * 게시글/자료 하위탭이 붙는 칩. 임시저장·예약은 «게시글에만 있는 상태»라 탭이 없다
 * (레거시도 category=data 에서 이 두 칩을 렌더하지 않는다 — mypage.vue:257·265).
 */
const DUAL_CHIPS: ReadonlySet<ChipKey> = new Set<ChipKey>(['important', 'my', 'trash'])

export function hasTabs(chip: ChipKey): boolean {
  return DUAL_CHIPS.has(chip)
}

/** 탭이 없는 칩에서는 URL 에 뭐가 적혀 있든 게시글로 고정한다. */
export function resolveTab(chip: ChipKey, tab: MyTab | undefined): MyTab {
  return hasTabs(chip) && tab === 'file' ? 'file' : 'post'
}

/**
 * 「내 글」 계열 칩이 쓰는 `state`.
 * ⚠ 서버에 enum 검증이 없어 오타가 400 이 아니라 **200 빈 페이지**로 온다(05:354, BR-041).
 *   그래서 화면에서 문자열을 만들지 않고 이 표에서만 꺼낸다.
 * `DEL` 은 저장값이 아니라 조회 선택자다 — 응답 state 는 deleted_at 으로 계산된다(05:145).
 */
const POST_STATE: Record<Exclude<ChipKey, 'important'>, PostQueryState> = {
  my: 'ACT',
  draft: 'SAVE',
  schedule: 'SCHEDULED',
  trash: 'DEL',
}

/** 자료 쪽은 하드 enum 이라 그 외 값이 400 이다(09:129). 자료에 SAVE/SCHEDULED 는 없다. */
const FILE_STATE: Record<'my' | 'trash', DriveQueryState> = { my: 'ACT', trash: 'DEL' }

export type MyListPlan =
  | { kind: 'post'; path: '/posts/mine'; params: MyPostListParams }
  | { kind: 'post'; path: '/posts/bookmarks'; params: { take: number; page: number } }
  | { kind: 'file'; path: '/drive-files/mine'; params: MyDriveFileListParams }
  | { kind: 'file'; path: '/drive-files/bookmarks'; params: { take: number; page: number } }

/**
 * 칩 × 탭 → 엔드포인트 + 쿼리. **여기가 유일한 구현이다.**
 *
 * 절대 만들지 않는 두 키:
 *  - `is_bookmark` — 문자열 truthiness 라 `"false"`·`"00"`·`"no"` 가 전부 참이고(05:355 · 09:251),
 *    `/drive-files/mine` 에 `0` «만» 붙이면 400 이다(09:178). 북마크는 전용 경로로만 간다.
 *  - `sort[by]` — 생략해야 서버가 state 별 기본값(DEL→updated_at · SAVE→created_at · 그 외→posted_at)
 *    을 고른다. «미지 이름»은 생략과 달리 created_at 으로 떨어져 오히려 틀린다(05:357·412).
 */
export function buildMyListParams(
  chip: ChipKey,
  tab: MyTab,
  page: number,
  take: number,
): MyListPlan {
  const paging = { take, page }
  if (chip === 'important') {
    return tab === 'file'
      ? { kind: 'file', path: '/drive-files/bookmarks', params: paging }
      : { kind: 'post', path: '/posts/bookmarks', params: paging }
  }
  if (tab === 'file' && (chip === 'my' || chip === 'trash')) {
    return {
      kind: 'file',
      path: '/drive-files/mine',
      params: { state: FILE_STATE[chip], ...paging },
    }
  }
  return { kind: 'post', path: '/posts/mine', params: { state: POST_STATE[chip], ...paging } }
}
