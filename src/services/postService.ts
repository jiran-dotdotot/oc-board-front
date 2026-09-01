// 게시글 API 서비스. GET /api/v1/post (selectPost) — 전부 쿼리 파라미터.
import { apiClient } from '@/lib/apiClient'
import { serializeParams } from '@/lib/queryParams'
import type { Paginated, Post, PostListParams, PostSort } from '@/types/post'

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
  // bool은 켤 때만 1 (끌 땐 생략 — "false" 문자열이 truthy로 평가되는 백엔드 이슈 회피)
  if (params.is_include_comment) q.is_include_comment = 1
  if (params.is_public_only) q.is_public_only = 1
  // is_view는 0/1 명시(생략=전체). 0=안읽음(안 본 글), 1=읽음(본 글)
  if (params.is_view !== undefined) q.is_view = params.is_view ? 1 : 0
  const sort = params.sort ?? { by: 'posted_at', order: 'desc' }
  q['sort[by]'] = sort.by
  q['sort[order]'] = sort.order
  if (sort.value) q['sort[value]'] = sort.value

  const { data } = await apiClient.get<Paginated<Post>>('/post', {
    params: q,
    paramsSerializer: { serialize: serializeParams },
    headers: { lang },
  })
  return data
}

// 공지 목록: 유효한 NOTICE 뱃지 글을 페이징 없이 전량(is_not_paging=1 → 배열 반환).
// 게시판 목록 상단 고정용. 안읽음 필터일 땐 안 읽은 공지만(is_view=0).
export async function selectNotices(
  params: { board_id?: string; is_view?: boolean; sort?: PostSort },
  lang: string,
): Promise<Post[]> {
  const q: Record<string, unknown> = {
    board_id: params.board_id,
    badges: ['NOTICE'],
    is_not_paging: 1,
    limit: 100, // ponytail: 활성 공지 상한 100 — 실무상 충분, 넘치면 limit만 상향
  }
  if (params.is_view !== undefined) q.is_view = params.is_view ? 1 : 0
  const sort = params.sort ?? { by: 'posted_at', order: 'desc' }
  q['sort[by]'] = sort.by
  q['sort[order]'] = sort.order

  const { data } = await apiClient.get<Post[]>('/post', {
    params: q,
    paramsSerializer: { serialize: serializeParams },
    headers: { lang },
  })
  return data
}

// 게시글 북마크 토글 (POST /post/bookmark/{post} — docs/api/06-post-write.md §9).
// ⚠ 응답(PostBookmark)에 timestamps 가 없어 **응답만으로 현재 ON/OFF 를 알 수 없다.**
//   문서 지침대로 목록의 is_bookmark($appends) 를 정본으로 쓴다 → 호출 후 목록을 무효화한다.
//   (게시판 북마크 POST /board/bookmark 는 deleted_at 이 와서 판정 가능 — 규약이 다르다)
export async function togglePostBookmark(postId: string): Promise<void> {
  await apiClient.post(`/post/bookmark/${postId}`)
}
