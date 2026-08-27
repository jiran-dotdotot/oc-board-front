// 게시글 목록/상세 API 타입 (GET /api/v1/post — selectPost)

export interface PostUser {
  id: number
  name: string
}

export interface PostBadge {
  type: string // 'NOTICE' | 'MUST_READ' 등
}

export interface PostFile {
  id: string
  name?: string
}

export interface PostBoard {
  id: string
  name: string
}

export interface PostThumbnail {
  id: string
  url?: string
}

// 목록 각 게시글 필드 (관계: board, badges, files, user, thumbnail)
export interface Post {
  id: string
  seq: number
  category_id: string | null
  board_id: string
  user_id: number
  state: string
  title: string
  comment_count: number
  text_content: string // 앞 300자
  view_count: number
  like_count: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  posted_at: string | null
  delete_user_id: number | null
  board?: PostBoard
  badges?: PostBadge[]
  files?: PostFile[]
  user?: PostUser
  thumbnail?: PostThumbnail | null
  // $appends — 매 응답에 항상 포함(docs/api/05-post-read.md §공통). 현재 유저 기준 계산값.
  is_writable?: boolean // 내 글 여부(작성자==나) — "쓰기 권한"이 아님
  is_view?: boolean // 내가 읽었는지(읽음=true, 내 글이면 항상 true)
  is_bookmark?: boolean // 내 북마크 여부
  is_like?: boolean // 내 공감 여부
  schedule_at_tz?: string | null // 예약 게시 일시(앱 타임존)
}

// Laravel 페이지네이션 응답
export interface Paginated<T> {
  data: T[]
  total: number
  current_page: number
  per_page: number
  last_page: number
  from: number | null
  to: number | null
}

export interface PostSort {
  by: string // post.posts 실제 컬럼명 또는 'relative'
  order: 'asc' | 'desc'
  value?: string // sort.by='relative'일 때 키워드
}

// GET /post 쿼리 파라미터 (필터/페이징). bool은 켤 때 1, 끌 땐 생략.
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
