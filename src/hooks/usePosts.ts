import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { isAuthenticated } from '@/lib/authStorage'
import { selectNotices, selectPost, togglePostBookmark } from '@/services/postService'
import type { PostListParams } from '@/types/post'

// 게시글 목록 조회. lang 헤더는 현재 i18n 언어, 페이지 전환 시 이전 데이터 유지.
export function usePosts(params: PostListParams) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['posts', params, i18n.language],
    queryFn: () => selectPost(params, i18n.language),
    placeholderData: keepPreviousData,
    enabled: isAuthenticated(), // 토큰 없으면 호출 안 함(401 리다이렉트 루프 방지)
  })
}

// 게시판 공지 목록(상단 고정용). is_not_paging → 배열 반환. 안읽음 필터면 is_view 전달.
// enabled=false 면 아예 호출하지 않는다 — board_id 없이 부르면 전 게시판 공지를 긁어온다.
//
// ⚠ keepPreviousData 를 쓰지 않는다. enabled=false 여도 placeholderData 는 «이전 쿼리의 data»
// 를 내려주고 status 를 success 로 승격시켜(queryObserver), 가드가 막으려던 오염이
// 캐시 경로로 되살아난다 — /board/recent 가 직전 게시판의 공지를 상단 고정으로 띄웠다.
// 공지는 is_not_paging 짧은 배열이라 잠깐 비는 편이 «다른 게시판 공지»보다 낫다.
export function useNotices(params: { board_id?: string; is_view?: boolean }, enabled = true) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['notices', params, i18n.language],
    queryFn: () => selectNotices(params, i18n.language),
    enabled: enabled && isAuthenticated(),
  })
}

// 게시글 북마크 토글. 현재 상태는 목록의 is_bookmark 가 정본이라 목록·공지 둘 다 무효화한다.
export function usePostBookmarkMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (postId: string) => togglePostBookmark(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] })
      qc.invalidateQueries({ queryKey: ['notices'] })
    },
  })
}
