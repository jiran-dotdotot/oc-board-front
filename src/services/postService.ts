// 게시글·댓글·공감 API — 전부 Go 스코프 경로(docs/api/go/05·06·07).
// 옛 /api/v1/post/** prefix 는 Go 에 없다(go/README.md:196) — 호환 rewrite 대상도 아니다.
import {
  deleteBoardResource,
  getBoardResource,
  postBoardResource,
  putBoardResource,
} from '@/lib/boardApi'
import { serializeParams } from '@/lib/queryParams'
import type {
  LikeUser,
  MyPostListParams,
  Paginated,
  Post,
  PostBulkResult,
  PostComment,
  PostDetail,
  PostListParams,
  PostSort,
  PostUpdateBody,
  PostWriteBody,
  PostWriteResult,
  ViewLogUser,
} from '@/types/post'

// 활성 공지 상한. ponytail: take 로 한 페이지만 — 실무상 충분, 넘치면 이 값만 올린다.
// ⚠ 이건 «우리» 상한이다. /posts 의 take 에는 정책 상한이 없다
//   (docs/api/go/05-post-read.md:46 · :259 「상한 없음」). 100 clamp 는 자료실 전용이다
//   (docs/api/go/09-drive-file.md:121).
const NOTICE_TAKE = 100

export async function selectPost(params: PostListParams, lang: string): Promise<Paginated<Post>> {
  const q: Record<string, unknown> = {
    board_id: params.board_id,
    category_id: params.category_id,
    user_id: params.user_id,
    user_name: params.user_name,
    badges: params.badges,
    except_badges: params.except_badges,
    search: params.search,
    title_content: params.title_content,
    title: params.title,
    content: params.content,
    start_posted_at: params.start_posted_at,
    end_posted_at: params.end_posted_at,
    limit_day: params.limit_day,
    take: params.take ?? 20,
    page: params.page ?? 1,
  }
  // Go bool query: 1=true, 생략=false. is_view만 문자열 0/1 규칙이다(05:268,295).
  if (params.is_include_comment) q.is_include_comment = 1
  if (params.is_public_only) q.is_public_only = 1
  // is_view는 0/1 명시(생략=전체). 0=안읽음(안 본 글), 1=읽음(본 글)
  if (params.is_view !== undefined) q.is_view = params.is_view ? 1 : 0
  const sort = params.sort ?? { by: 'posted_at', order: 'desc' }
  q['sort[by]'] = sort.by
  q['sort[order]'] = sort.order
  if (sort.value) q['sort[value]'] = sort.value

  const { data } = await getBoardResource<Paginated<Post>>('/posts', {
    params: q,
    paramsSerializer: { serialize: serializeParams },
    headers: { lang },
  })
  return data
}

// 공지 목록: 유효한 NOTICE 뱃지 글. 게시판 목록 상단 고정용.
// 안읽음 필터일 땐 안 읽은 공지만(is_view=0).
// ⚠ is_not_paging 을 쓰지 않는다 — 문서(05:39·307)는 배열을 준다고 하지만 실서버는
//   1/true 어느 값이든 «페이지 봉투»를 준다(2026-09-09 실측, BR-004). 봉투가 정본이다.
export async function selectNotices(
  params: { board_id?: string; is_view?: boolean; sort?: PostSort },
  lang: string,
): Promise<Post[]> {
  const q: Record<string, unknown> = {
    board_id: params.board_id,
    badges: ['NOTICE'],
    take: NOTICE_TAKE,
    page: 1,
  }
  if (params.is_view !== undefined) q.is_view = params.is_view ? 1 : 0
  const sort = params.sort ?? { by: 'posted_at', order: 'desc' }
  q['sort[by]'] = sort.by
  q['sort[order]'] = sort.order

  const { data } = await getBoardResource<Paginated<Post>>('/posts', {
    params: q,
    paramsSerializer: { serialize: serializeParams },
    headers: { lang },
  })
  return data.data
}

// 게시글 북마크 토글 (POST .../posts/{id}/bookmark — docs/api/go/06-post-write.md:506).
// Go 응답은 이번 호출 «후» 상태를 is_bookmarked 로 직접 준다 — deleted_at 을 추론하지 않는다.
export async function togglePostBookmark(postId: string): Promise<boolean> {
  const { data } = await postBoardResource<{ is_bookmarked: boolean }>(`/posts/${postId}/bookmark`)
  return data.is_bookmarked
}

// ─── 게시글 상세 (docs/api/go/05-post-read.md:448) ─────────────────────────
// ⚠ 이 호출은 부수효과가 있다 — state=ACT 이면 매 호출마다 조회가 1건 쌓인다.
//   상세 = 조회 1회다. 따라서 화면에서 읽음 처리를 «추가로» 부르면 이중 집계가 된다.
export async function getPost(postId: string, lang: string): Promise<PostDetail> {
  const { data } = await getBoardResource<PostDetail>(`/posts/${postId}`, { headers: { lang } })
  return data
}

// ─── 게시글 작성·수정 (docs/api/go/06-post-write.md:192 · :252) ──────────────
// JSON 만 받는다 — 이 경로엔 폼 변환 middleware 가 없어 multipart 는 415 다(06:52).
// 서버는 HTML 을 살균하지 않는다(06:39) → 호출 전에 `sanitizePostHtml` 을 거친다.
// 응답엔 관계가 없다(06:90) — 뱃지·첨부는 상세 재조회로만 확인된다(BR-042).

/** 작성. 게시판 404 → Write 403 → 날짜 400 → 뱃지 CanManage 403 → POST_SCHEDULE_REQUIRED → BADGE_PERIOD_INVALID(06:228). */
export async function createPost(boardId: string, body: PostWriteBody): Promise<PostWriteResult> {
  const { data } = await postBoardResource<PostWriteResult>(`/boards/${boardId}/posts`, body)
  return data
}

/** 수정 — 작성자 전용(관리자도 403, 06:40). 목적지 board_id 검사가 원본 조회보다 먼저다(06:292). */
export async function updatePost(postId: string, body: PostUpdateBody): Promise<PostWriteResult> {
  const { data } = await putBoardResource<PostWriteResult>(`/posts/${postId}`, body)
  return data
}

// ─── 게시글 첨부 업로드 (POST /posts/{id}/attachments) ──────────────────────
// 실소스 계약: oc-api-go internal/transport/httpapi/board/attachmentupload.go.
// ⚠ 복사본 docs/api/go 엔 아직 문서가 없다(BR-037) — 계약은 실소스에서 직접 확인했다.
// multipart 필드 `file` **단일·필수**. 서버 검증: 확장자 필수·0<size≤100MB·이미지면 W*H≤4천만px.
// 응답 {id, state:"ACTIVE"}. 한 요청에 파일 하나뿐이라 N개는 N번 부른다.
// ⚠ 글이 이미 있어야 한다(작성자 + 쓰기 권한이 아니면 404/403) — 저장으로 id 를 얻은 뒤 부른다.
// ⚠ apiClient 기본 헤더가 application/json 이라 FormData 요청엔 multipart 를 명시해야
//   axios 1.x 가 boundary 를 채워 넣는다(명시 없으면 json 헤더가 남아 서버가 못 읽는다).
export interface AttachmentUploadResult {
  id: string
  state: string
}

export async function uploadPostAttachment(
  postId: string,
  file: File,
): Promise<AttachmentUploadResult> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await postBoardResource<AttachmentUploadResult>(
    `/posts/${postId}/attachments`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data
}

/**
 * 여러 첨부를 순차 업로드한다. 한 건이 실패해도 나머지는 계속 올리고, 성공/실패를 갈라 돌려준다.
 * 순차인 이유: 부분 실패를 파일 단위로 정확히 보고하고 업로드 폭주를 피하기 위함이다.
 */
export async function uploadPostAttachments(
  postId: string,
  files: File[],
): Promise<{ uploaded: { id: string; file: File }[]; failed: File[] }> {
  const uploaded: { id: string; file: File }[] = []
  const failed: File[] = []
  for (const file of files) {
    try {
      const r = await uploadPostAttachment(postId, file)
      uploaded.push({ id: r.id, file })
    } catch {
      failed.push(file)
    }
  }
  return { uploaded, failed }
}

// 게시글 삭제 — 휴지통(복원 가능). Go 에 단건 DELETE 는 «등록되어 있지 않고»
// DELETE .../posts?id={UUID} 로 재작성될 뿐이라(go/README.md:189) 처음부터 일괄 경로를 쓴다.
// 부분 실패도 200 이므로 ignored_ids 로 판정한다.
export async function deletePosts(ids: string[]): Promise<PostBulkResult> {
  const { data } = await deleteBoardResource<PostBulkResult>('/posts', { ids })
  return { affected: data?.affected ?? 0, ignored_ids: data?.ignored_ids ?? [] }
}

export async function deletePost(postId: string): Promise<boolean> {
  const { affected } = await deletePosts([postId])
  return affected > 0
}

// ─── 내 활동 목록 (docs/api/go/05-post-read.md:332 · :389) ──────────────────

/**
 * 내 글 목록. 칩(내 글·임시저장·예약·휴지통)이 전부 이 경로 하나에 `state` 로만 갈린다.
 *
 * ⚠ `state` 를 반드시 보낸다 — 생략하면 조회 없이 **200 빈 페이지**다(05:354).
 * ⚠ `is_bookmark` 를 절대 보내지 않는다 — 문자열 truthiness 라 `"false"` 도 북마크 분기다(05:355).
 * ⚠ `sort[by]` 를 보내지 않는다 — 생략해야 서버가 state 별 기본값을 고른다
 *   (DEL→updated_at · SAVE→created_at · 그 외→posted_at, 05:357). 미지 이름은 created_at 으로 떨어진다.
 * read gate 가 없어 목록에 보여도 상세는 403 일 수 있다(05:373).
 */
export async function selectMyPosts(
  params: MyPostListParams,
  lang: string,
): Promise<Paginated<Post>> {
  const { data } = await getBoardResource<Paginated<Post>>('/posts/mine', {
    params: { state: params.state, take: params.take ?? 20, page: params.page ?? 1 },
    paramsSerializer: { serialize: serializeParams },
    headers: { lang },
  })
  return data
}

/**
 * 북마크한 게시글. 전용 경로라 `state`·`is_bookmark` 자체가 «선언되지 않았다»(05:405-411).
 * 대상은 같은 회사 + 미삭제 ACT + 내 live 북마크뿐이며, 여기도 read gate 가 없다(05:420).
 */
export async function selectBookmarkedPosts(
  params: { take?: number; page?: number },
  lang: string,
): Promise<Paginated<Post>> {
  const { data } = await getBoardResource<Paginated<Post>>('/posts/bookmarks', {
    params: { take: params.take ?? 20, page: params.page ?? 1 },
    paramsSerializer: { serialize: serializeParams },
    headers: { lang },
  })
  return data
}

// ─── 내 활동 일괄 쓰기 (docs/api/go/06-post-write.md:316 · :362 · :408) ──────
// ⚠ 게시글 일괄 body 는 **추가 키를 400 으로 거절**한다(06:336) — 자료실(허용·무시)과 다르므로
//   공용 헬퍼로 묶지 않는다. body 자체가 없으면 400, `{"ids":[]}` 는 200 no-op 이다(06:71).

/** 영구 삭제. **작성자**만, 이미 휴지통이며 아직 purge 안 된 것만(06:386). */
export async function purgePosts(ids: string[]): Promise<PostBulkResult> {
  const { data } = await deleteBoardResource<PostBulkResult>('/posts/purge', { ids })
  return { affected: data?.affected ?? 0, ignored_ids: data?.ignored_ids ?? [] }
}

/**
 * 복원. 자격은 **삭제자 == 요청자**다 — 작성자와 삭제자는 다른 개념이라,
 * 내가 쓴 글이라도 남이 지운 것은 복원할 수 없다(06:432).
 */
export async function restorePosts(ids: string[]): Promise<PostBulkResult> {
  const { data } = await postBoardResource<PostBulkResult>('/posts/restore', { ids })
  return { affected: data?.affected ?? 0, ignored_ids: data?.ignored_ids ?? [] }
}

// ─── 댓글 (docs/api/go/07-post-comment-like.md:184~) ───────────────────────
// ⚠ 전부 **body** 다. 작성만 201, 수정·삭제·공감은 200 이다(07 함정 1).

export async function insertComment(
  postId: string,
  comment: string,
  parentCommentId?: string,
): Promise<PostComment> {
  // parent_id 는 null 이면 최상위다 — 빈 문자열을 보내지 않도록 생략한다.
  const body: Record<string, unknown> = { comment }
  if (parentCommentId) body.parent_id = parentCommentId
  const { data } = await postBoardResource<PostComment>(`/posts/${postId}/comments`, body)
  return data
}

export async function updateComment(commentId: string, comment: string): Promise<PostComment> {
  const { data } = await putBoardResource<PostComment>(`/comments/${commentId}`, { comment })
  return data
}

// 삭제는 hard/soft delete 가 아니라 is_active=false 다(07:230). comment 가 null 로 마스킹되고
// comment_count 는 «줄지 않는다»(07:235) — 표시 댓글 수와 카운트가 다를 수 있다.
export async function deleteComment(commentId: string): Promise<PostComment> {
  const { data } = await deleteBoardResource<PostComment>(`/comments/${commentId}`)
  return data
}

// ─── 공감 토글 (docs/api/go/07:432 · 07:338) ──────────────────────────────
// 토글 단위는 (유저 × 대상 × 이모지). 같은 이모지 재요청이면 취소다.
// ⚠ 응답은 취소일 때도 **200** 이며 이번 호출 «후» 상태를 is_liked 로 준다.
// ⚠ 글 공감 body 는 엄격해서 추가 키를 보내면 400 이다(07 함정 5). emoji 만 보낸다.
export interface LikeToggleResult {
  emoji: string
  is_liked: boolean
  deleted_at: string | null
}

export async function togglePostLike(postId: string, emoji: string): Promise<LikeToggleResult> {
  const { data } = await postBoardResource<LikeToggleResult>(`/posts/${postId}/like`, { emoji })
  return data
}

export async function toggleCommentLike(
  commentId: string,
  emoji: string,
): Promise<LikeToggleResult> {
  const { data } = await postBoardResource<LikeToggleResult>(`/comments/${commentId}/like`, {
    emoji,
  })
  return data
}

// ─── 조회 · 공감 내역 (docs/api/go/07:526 · 07:480 · 07:386) ───────────────
// 셋 다 페이지 봉투, take 기본 20.
// ⚠ 공감 내역은 `emoji` 가 **필수**다 — 미전송 시 400 이라 이모지를 하나 고른 뒤에만 부른다.
// ⚠ 레거시는 댓글 공감 내역 페이징에 POST 를 써서 페이지를 넘길 때마다 내 반응이 토글됐다
//   (jupiter-board-web/src/stores/comment.ts:33). 여기서는 GET 이다.

export async function getPostViewers(
  postId: string,
  page: number,
  take: number,
): Promise<Paginated<ViewLogUser>> {
  const { data } = await getBoardResource<Paginated<ViewLogUser>>(`/posts/${postId}/views`, {
    params: { page, take },
  })
  return data
}

export async function getPostLikeUsers(
  postId: string,
  emoji: string,
  page: number,
  take: number,
): Promise<Paginated<LikeUser>> {
  const { data } = await getBoardResource<Paginated<LikeUser>>(`/posts/${postId}/likes`, {
    params: { emoji, page, take },
  })
  return data
}

export async function getCommentLikeUsers(
  commentId: string,
  emoji: string,
  page: number,
  take: number,
): Promise<Paginated<LikeUser>> {
  const { data } = await getBoardResource<Paginated<LikeUser>>(`/comments/${commentId}/likes`, {
    params: { emoji, page, take },
  })
  return data
}
