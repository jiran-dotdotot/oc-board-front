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
  Paginated,
  Post,
  PostComment,
  PostDetail,
  PostListParams,
  PostSort,
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

// 게시글 삭제 — 휴지통(복원 가능). Go 에 단건 DELETE 는 «등록되어 있지 않고»
// DELETE .../posts?id={UUID} 로 재작성될 뿐이라(go/README.md:189) 처음부터 일괄 경로를 쓴다.
// 부분 실패도 200 이므로 ignored_ids 로 판정한다.
export async function deletePost(postId: string): Promise<boolean> {
  const { data } = await deleteBoardResource<{ affected: number; ignored_ids: string[] }>(
    '/posts',
    { ids: [postId] },
  )
  return (data?.affected ?? 0) > 0
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
