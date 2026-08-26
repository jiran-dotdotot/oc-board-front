// 게시글 API 서비스. GET /api/v1/post (selectPost) — 전부 쿼리 파라미터.
import { apiClient } from '@/lib/apiClient'
import { serializeParams } from '@/lib/queryParams'
import type { Paginated, Post, PostListParams } from '@/types/post'

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
