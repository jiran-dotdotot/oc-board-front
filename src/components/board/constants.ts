// 공지 배너 자동 순환 주기(ms). 디자인엔 자동 순환 규정이 없어 정한 값 —
// 제목 한 줄을 읽고 넘어가기에 충분한 간격. hover/포커스·모달 열림·prefers-reduced-motion
// 이면 멈추고, 수동으로 넘기면 타이머가 처음부터 다시 돈다.
// 공지 상단 고정 상한 (디자인 「공지 초과 표시 시안」 6a — CAP=3).
// 초과분은 「숨은 공지 N건 모두 보기」 토글로 펼친다. 공지는 페이지네이션 카운트에서 분리된다.
export const NOTICE_TOP_CAP = 3

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

// ─── 글쓰기 ─────────────────────────────────────────────────────────────────
/** 제목 최대 길이(코드포인트). 레거시 maxlength 200(AddPostView.vue:860) · 정본 `{{ wTitleLen }}/200`.
 *  Go 는 길이 상한이 없다(docs/api/go/06-post-write.md:215) — 이건 «우리» 상한이다. */
export const TITLE_MAX = 200

/**
 * 「항상 고정」 공지의 종료값. ⚠️ 가정(A1): Go 에 무기한 표현이 없고 「명시적 2999년 종료값을
 * 보낸다」고만 지시한다(06-post-write.md:67). 복원은 연도 2999 판정(05-post-read.md:104).
 * 레거시 '2999-12-31 23:59:59'(AddPostView.vue:338) 과 같은 시각을 로컬 오프셋으로 보낸다.
 */
export const NOTICE_FOREVER_YEAR = 2999

/** 예약 발행 기본값 = 지금 + 1시간(레거시 AddPostView.vue:103), 분은 5분 단위로 올림(정본 문구). */
export const SCHEDULE_DEFAULT_OFFSET_MS = 60 * 60 * 1000
export const SCHEDULE_STEP_MIN = 5
/** 정본 예약 달력의 빠른 선택 시각 칩(web.html:1651 `calTimes`). */
export const SCHEDULE_QUICK_TIMES = ['09:00', '10:00', '14:00', '18:00'] as const

/**
 * 게시글 첨부 «업로드» 게이트. 실소스로 계약 확인됨(BR-037) — `POST /posts/{id}/attachments`,
 * multipart `file` 단일, 확장자 필수·0<size≤100MB·이미지 W*H≤4천만px, 응답 {id,state:"ACTIVE"}
 * (oc-api-go attachmentupload.go). 복사본 docs/api/go 엔 아직 문서가 없으니 backfill 대상이다.
 * 글 id 가 있어야 부르므로 저장으로 id 를 얻은 뒤 파일마다 순차 업로드한다(uploadPostAttachments).
 */
export const POST_ATTACHMENT_UPLOAD_ENABLED = true

/**
 * 대표이미지 «업로드» 게이트. **서버에 생성 경로가 없다** — 유일한 업로드는 항상 `type='FILE'` 로만
 * 넣고(attachmentupload.go), 전용 썸네일 업로드 라우트가 없다. 수정 핸들러도 `file`·`thumbnail`
 * multipart 키를 create 는 400·update 는 무시로 거부한다(postwrite.go B-10, "no upload path").
 * 삭제(`delete_thumbnail_id`, 06:284)만 계약이 있어 기존 썸네일 제거는 게이트 밖이다.
 * 서버가 업로드 시 `type` 을 받거나 전용 라우트를 열면 이 값만 true 로 바꾼다(BR-037).
 */
export const POST_THUMBNAIL_UPLOAD_ENABLED = false
/** 첨부 한도 — 레거시 값(AddPostView.vue:126·140·107). Go 계약이 없어 안내 문구에만 쓴다(BR-037). */
export const ATTACHMENT_MAX_COUNT = 10
export const ATTACHMENT_MAX_TOTAL_BYTES = 100 * 1024 * 1024
export const THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024

/**
 * 나모 에디터 호스트(레거시 AddPostView.vue:444). ⚠️ 가정(A7): `.env*` 는 확인 대상이라 상수로 두고
 * `VITE_NAMO_EDITOR_URL` 이 정의돼 있으면 그 값을 우선한다. 실측 2026-09-10: 200 · 프레임 제한 헤더
 * 없음 · 에디터 postMessage 대상 '*'. 본문 이미지는 이 호스트가 저장한다(BR-043).
 */
export const NAMO_EDITOR_URL: string =
  (import.meta.env.VITE_NAMO_EDITOR_URL as string | undefined)?.trim() ||
  'https://namo-editor.jupiterstudio.co.kr/editor'
/** 에디터 무응답 한도. 레거시는 25초 뒤 «예전 본문»을 저장했다(AddPostView.vue:428-441) — 여기선 실패로 끝낸다. */
export const NAMO_EDITOR_TIMEOUT_MS = 15_000
/** iframe 높이 — 레거시 AddPostView.vue:949 (데스크톱 580 / 모바일 356). */
export const NAMO_EDITOR_HEIGHT = { desktop: 580, mobile: 356 } as const
