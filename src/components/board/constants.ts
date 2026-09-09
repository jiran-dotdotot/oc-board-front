import type { Post } from './types'

// 공지 배너 자동 순환 주기(ms). 디자인엔 자동 순환 규정이 없어 정한 값 —
// 제목 한 줄을 읽고 넘어가기에 충분한 간격. hover/포커스·모달 열림·prefers-reduced-motion
// 이면 멈추고, 수동으로 넘기면 타이머가 처음부터 다시 돈다.
// 공지 상단 고정 상한 (디자인 「공지 초과 표시 시안」 6a — CAP=3).
// 초과분은 「숨은 공지 N건 모두 보기」 토글로 펼친다. 공지는 페이지네이션 카운트에서 분리된다.
export const NOTICE_TOP_CAP = 3

// 백엔드 연동 전 데모용 샘플 데이터. (실서비스에서는 apiClient + useQuery로 대체)
export const SAMPLE_POSTS: Post[] = [
  { id: 1, title: '첫 번째 공지사항', author: '관리자', createdAt: '2026-08-01' },
  { id: 2, title: '게시판 리뉴얼 안내', author: '관리자', createdAt: '2026-08-05' },
  { id: 3, title: '자유게시판이 열렸습니다', author: 'OC', createdAt: '2026-08-10' },
]

// ─── 게시글 상세 ───────────────────────────────────────────────────────────
/**
 * 공감으로 «새로 누를 수 있는» 이모지 세트.
 *
 * ⚠️ 가정: 서버·디자인 정본·레거시 어디에도 «세트» 라는 개념이 없다.
 *  - 서버는 `emoji` 를 자유 문자열로 받고(docs/api/go/07-post-comment-like.md:44),
 *    상세의 `post.likes` 는 **반응이 1건 이상인 이모지만** 집계해 준다 → 세트를 줄 수 없다.
 *  - 레거시는 emoji-mart 전체 카탈로그 피커였다(EmojiSelector.vue:3).
 *  - 정본 아트보드엔 이모지 리터럴이 0건이다(프로토타입 시드값).
 * 정본 스크린샷에서 읽히는 👍 ❤️ 😊 를 앞에 두고 채운 값이다. 이 상수만 고치면 바뀐다.
 *
 * 세트 «밖»의 이모지로 달린 기존 반응은 사라지지 않는다 — 칩은 서버 집계를 그대로 그린다.
 */
export const REACTION_EMOJIS = ['👍', '❤️', '😊', '🎉', '😢', '👏'] as const

/**
 * 공감 줄에 **항상 보이는** 칩. 반응이 0건이어도 그린다(정본 스크린샷의 `🏷 0` 자리).
 *
 * ⚠ 서버는 «반응이 1건 이상인» 이모지만 집계해 준다(docs/api/go/07-post-comment-like.md §공감 집계) →
 *   0 카운트 칩은 서버에서 나올 수 없고 이 상수로만 그릴 수 있다.
 *   ⚠ 4개는 «우리 결정»이다. 정본 `dReactChips` 의 반복수는 2 이고(4 는 다른 요소인
 *   `postPkEmojis` 값이다), 고정 칩 개수를 지정한 정본 근거는 없다.
 *   세트 «밖» 이모지로 달린 기존 반응은 이 네 칩 뒤에 이어 붙는다 — 데이터가 숨지 않는다.
 */
export const REACTION_PINNED = ['👍', '❤️', '😊', '🎉'] as const

/** 댓글의 하트 버튼이 토글하는 이모지. 정본 댓글 행엔 하트 하나뿐이라 ❤️ 로 잇는다. */
export const COMMENT_HEART_EMOJI = '❤️'

/** 첨부 목록에서 접기 전에 보여 주는 행 수. 정본 `dAttRows` 3행 + 「외 N개 모두 보기」. */
export const ATTACHMENT_PREVIEW_ROWS = 3

/** 내역 모달 페이지당 개수. API 기본값과 같다(docs/api/go/05-post-read.md:259, go/07:325). */
export const HISTORY_PAGE_SIZE = 20
