// Go 목록 DTO에서 사용하는 필드. 상세·댓글의 기존 타입은 해당 서비스 전환 때 갱신한다.

// Go 작성자 projection. docs/api/go/05-post-read.md:76-88.
export interface PostUser {
  id: number
  name: string | null
  profile_image_id?: string | null
  profile_src?: string | null
  account?: string
  disabled_at?: string | null // 비활성(퇴사) 처리 시각
  deleted_at?: string | null
}

export interface PostBadge {
  /** 뱃지 PK — 수정 body 의 `delete_badge_id` 에 넣는 값(05:96·06:285). */
  id?: string
  type: string // Go 저장값은 NOTICE(05:102).
  /** Go 목록에는 항상 포함된다(05:108). NOTICE이면서 true인 배지만 공지로 표시한다.
      아직 미전환인 상세 DTO도 공유하므로 여기서는 optional을 유지한다. */
  is_active?: boolean
  /** UTC 타임스탬프(05:103-104). 무기한은 연도 2999 로 표현된다 — 요청 형식(공통 날짜 파서)과 다르다. */
  start_date?: string
  end_date?: string
}

// 첨부 한 칸. ⚠ Go 는 src/url 을 주지 않는다 — 다운로드는 첨부 id 로
// `…/attachments/{id}/download-url` 을 따로 받는다(05:45 · 05:495).
// 클라이언트가 object key 로 URL 을 재조립하지 않는다.
export interface PostFile {
  id: string
  origin_file_name: string
  extension?: string
  size?: number // bytes
}

// ⚠ 게시판명 컬럼은 `title` 이다 — `name` 은 board.boards 에 없다(docs/api/go/04-board.md:80).
// 예전 `name` 정의 때문에 목록의 '위치' 컬럼이 전부 빈 문자열로 렌더됐다.
export interface PostBoard {
  id: string
  title: string
}

// Go 썸네일만 조건부 URL/resize 객체를 포함한다. 파일 첨부에는 src/url이 없다(05:112-132).
export interface PostThumbnail {
  id: string
  url?: string
  src?: { s: string; s_m: string; m: string; l_m: string; l: string; o: string; data: string }
}

// 목록 각 게시글 필드 (관계: board, badges, files, user, thumbnail)
// Go 목록 계약: docs/api/go/05-post-read.md:134-170. 상세 DTO와는 별개다.
export interface Post {
  id: string
  seq: number
  category_id: string | null
  board_id: string
  user_id: number | null
  state: string
  title: string | null
  comment_count: number
  text_content: string // 목록 앞 299자
  view_count: number
  like_count: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  posted_at: string | null
  delete_user_id: number | null
  /** 삭제자 이름만 오는 projection(05:157). 휴지통 「삭제자」 컬럼용. */
  delete_user?: { name: string | null } | null
  board?: PostBoard
  badges?: PostBadge[]
  files?: Pick<PostFile, 'id' | 'origin_file_name' | 'extension' | 'size'>[]
  user?: PostUser | null
  thumbnail?: PostThumbnail | null
  // Go 목록의 현재 사용자 기준 계산값(05:159-162).
  is_writable?: boolean // 내 글 여부(작성자==나) — "쓰기 권한"이 아님
  is_view?: boolean // 내가 읽었는지(읽음=true, 내 글이면 항상 true)
  is_bookmark?: boolean // 내 북마크 여부
  is_like?: boolean // 내 공감 여부
  schedule_at_tz?: string | null // 예약 게시 일시(앱 타임존)
}

// Go 페이지 봉투의 업무 필드. from/to/페이지 URL은 제공하지 않는다(05:62-72).
export interface Paginated<T> {
  data: T[]
  total: number
  current_page: number
  per_page: number
  last_page: number
}

export interface PostSort {
  by: string // post.posts 실제 컬럼명 또는 'relative'
  order: 'asc' | 'desc'
  value?: string // sort.by='relative'일 때 키워드
}

// Go scoped GET /posts 쿼리(05:258-301). bool은 켤 때 1, 끌 땐 생략.
export interface PostListParams {
  board_id?: string
  category_id?: string
  user_id?: number
  user_name?: string
  is_view?: boolean // 읽음 필터: undefined=전체(생략) · false=안읽음(is_view=0) · true=읽음(is_view=1)
  badges?: string[]
  except_badges?: string[]
  search?: string
  title_content?: string
  title?: string
  content?: string
  is_include_comment?: boolean
  start_posted_at?: string
  end_posted_at?: string
  limit_day?: number
  sort?: PostSort
  take?: number
  page?: number
  is_public_only?: boolean
}

// ─── 게시글 상세 (GET /api/v1/post/{post} — getPost) ────────────────────────
// 근거: docs/api/go/05-post-read.md §상세 DTO. 목록 필드 전체 + content + 아래 추가 필드.

/** 게시글 상태. state != 'ACT' 이면 prev/next/row_num 이 전부 null 이고 조회 로그도 안 남는다. */
export type PostState = 'ACT' | 'DEL' | 'SAVE' | 'HIDE' | 'SCHEDULED'

/**
 * 조회 쿼리(`?state=`)에 넣을 수 있는 값. `DEL` 은 **조회 전용 선택자**다 —
 * 저장되는 값이 아니라 `deleted_at IS NOT NULL AND purged_at IS NULL` 을 고르는 키워드다
 * (docs/api/go/05-post-read.md:354·365).
 * ⚠ 서버에 enum 검증이 «없다». 오타는 400 이 아니라 **200 빈 페이지**로 온다(05:354, BR-041)
 *   → 화면에서 문자열을 조립하지 말고 반드시 이 타입의 상수만 쓴다.
 */
export type PostQueryState = PostState

/** POST/PUT body 의 state. `DEL` 은 **쓰기 enum 에 없다**(06-post-write.md:214). */
export type PostWriteState = Exclude<PostState, 'DEL'>

/** `badges[]` 항목(06-post-write.md:58-67). `type` 은 보내도 버려지고 NOTICE 로 고정된다. 둘 다 필수. */
export interface PostBadgeBody {
  start_date: string
  end_date: string
}

/**
 * `POST {S}/boards/{id}/posts` body(06-post-write.md:212-222). 전부 선택이고 `{}` 도 SAVE 빈 글이다.
 * ⚠ 추가 키는 «허용 후 무시»다 — `files` 를 넣어도 첨부가 붙지 않는다(06:224).
 * ⚠ 불리언은 legacy.Bool(true/false/0/1/"0"/"1"/null) — 우리는 JSON boolean 만 보낸다(06:54).
 * ⚠ `not_send_alarm` 은 저장 필드가 아니라 이 요청의 알림 억제 플래그다(06:219).
 */
export interface PostWriteBody {
  state?: PostWriteState
  title?: string
  content?: string
  is_allow_comment?: boolean
  is_comment_alarm?: boolean
  not_send_alarm?: boolean
  /** 공통 날짜 파서 — RFC3339 · `YYYY-MM-DD HH:mm:ss` · `YYYY-MM-DD`(06:15). */
  schedule_at?: string
  delete_schedule_at?: boolean
  badges?: PostBadgeBody[]
}

/**
 * `PUT {S}/posts/{id}` body(06-post-write.md:272-286). 생략 = null = 유지, 빈 문자열 = 지움.
 * ⚠ `board_id` 이동은 원본이 SAVE 일 때만 실제 적용된다(06:274) — 그 밖엔 보내지 않는다.
 * ⚠ SCHEDULED 글에 `delete_schedule_at:true` 만 보내면 400 `POST_SCHEDULE_REQUIRED` 다(06:46) —
 *   `state` 를 함께 바꿔야 한다.
 */
export interface PostUpdateBody extends PostWriteBody {
  board_id?: string
  delete_file_id?: string[]
  delete_thumbnail_id?: string[]
  delete_badge_id?: string[]
}

/**
 * 작성 201 / 수정 200 응답(06-post-write.md:91-121). **관계(user/board/badges/files/thumbnail)가
 * 없다**(06:90) — 저장 뒤 화면을 완성하려면 상세를 다시 읽어야 한다(BR-042).
 * 응답을 만들 때 상세 GET 을 부르지 않으므로 열람 행은 늘지 않는다(06:123).
 */
export interface PostWriteResult {
  id: string
  company_id: number
  category_id: string | null
  board_id: string
  user_id: number | null
  seq: number
  state: PostWriteState
  title: string | null
  content: string
  text_content: string
  is_allow_comment: boolean
  is_comment_alarm: boolean
  is_send_alarm: boolean
  is_notice_alarm: boolean
  posted_at: string | null
  schedule_at: string | null
  schedule_at_tz: string | null
  created_at: string
  updated_at: string
  delete_user_id: null
  deleted_at: null
  purged_at: null
  is_writable: boolean
  is_view: boolean
  is_bookmark: boolean
  is_like: boolean
  comment_count: number
  view_count: number
  like_count: number
}

/**
 * GET .../posts/mine 쿼리(05:346-355). GET /posts 와 파라미터 집합이 «다르다» —
 * 선언된 건 6개뿐이고 검색·필터는 무시된다(05:373).
 *
 * ⚠ `is_bookmark` 를 일부러 넣지 않았다. Go 의 문자열 파라미터라 `"false"`·`"00"`·`"no"` 가
 *   전부 «참»(북마크 분기)이고 `""`/`"0"` 만 거짓이다(05:355). 북마크는 전용 엔드포인트
 *   `/posts/bookmarks` 로만 간다 — 이 파라미터는 우리 코드에서 아예 만들지 않는다.
 * ⚠ `sort` 도 넣지 않는다. 생략하면 서버가 state 별 기본값을 고르지만
 *   (DEL→updated_at · SAVE→created_at · 그 외→posted_at, 05:357),
 *   «미지 이름»은 생략과 달리 created_at 으로 떨어져 오히려 틀린다.
 */
export interface MyPostListParams {
  state: PostQueryState
  take?: number
  page?: number
}

/**
 * 일괄 쓰기(삭제·영구삭제·복원) 공통 응답. 전건 거절도 200 affected=0 이다(06:344).
 * ⚠ `ignored_ids` 는 UUID **바이트순 정렬**이라 요청 순서를 보존하지 않는다(06:73)
 *   — 인덱스로 요청 배열과 짝지으면 안 된다. 거절 사유(권한·없음·상태)는 구분되지 않는다.
 */
export interface PostBulkResult {
  affected: number
  ignored_ids: string[]
}

/** 이모지별 공감 집계. ⚠ `is_reacted` 는 boolean 이 아니라 1/0 «숫자»다(05:243, 07:288). */
export interface PostLikeStat {
  emoji: string
  count: number
  is_reacted: number
}

/** 댓글별 공감 집계 — 게시글 상세에서만 온다(캐시 300초). comment_id 가 함께 실린다. */
export interface CommentLikeStat extends PostLikeStat {
  comment_id: string
}

/**
 * 댓글 한 칸. root/답글은 depth 가 아니라 parent_id 로 판정한다(depth 필드는 없다).
 * ⚠ `comment` 는 `is_active === false` 이면 **항상 null** 로 마스킹된다(07:121).
 *   → 「삭제된 댓글입니다」 자리표시자를 그려야 한다. 자식 대댓글은 연쇄 삭제되지 않는다(07:236).
 * ⚠ 자식 관계 키는 `child_comments` 하나다(docs/api/go/05-post-read.md:237).
 */
export interface PostComment {
  id: string
  post_id: string
  user_id: number | null
  /** root 는 null. 상세의 댓글 DTO 는 이 키만 준다(실측 2026-09-09). */
  parent_id: string | null
  /** 작성/수정 응답(CommentView)만 parent_id 와 같은 값을 이 별칭으로 함께 준다(07:CommentView). */
  parent_comment_id?: string | null
  is_active: boolean
  comment: string | null
  created_at: string
  updated_at: string
  is_mine?: boolean
  user?: PostUser
  likes?: CommentLikeStat[]
  child_comments?: PostComment[]
}

// 상세 DTO(GET .../posts/{id}). 목록 필드 + content + 아래 추가 필드.
export interface PostDetail extends Omit<Post, 'files'> {
  files?: PostFile[]
  content: string // 본문 HTML 원문 — 렌더 전 반드시 살균한다
  schedule_at?: string | null
  is_comment_alarm?: boolean
  is_mine?: boolean
  is_admin?: boolean // 회사 관리자 또는 «게시판» 관리자 — 삭제 권한 판정용
  is_allow_comment?: boolean
  comments?: PostComment[]
  likes?: PostLikeStat[]
  prev_post_id?: string | null
  next_post_id?: string | null
  row_num?: number | null
}

/** 공감/조회 내역 모달의 행. `emoji` 는 조회 시 **필수 파라미터**다(미전송 400 — 07:325). */
export interface LikeUser {
  user_id: number
  created_at: string
  user?: PostUser
}

/** 조회자 목록 행 — user_id 로 그룹핑되어 유저별 총 횟수와 마지막 시각이 온다(05:256-263). */
export interface ViewLogUser {
  user_id: number
  count: number
  last_visit_at: string
  user?: PostUser
}
