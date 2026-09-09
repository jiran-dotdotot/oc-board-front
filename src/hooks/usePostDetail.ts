import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { isAuthenticated } from '@/lib/authStorage'
import {
  deleteComment,
  deletePost,
  getPost,
  insertComment,
  toggleCommentLike,
  togglePostBookmark,
  togglePostLike,
  updateComment,
} from '@/services/postService'
import type { PostDetail } from '@/types/post'
import { appendComment, applyToggle, mapCommentTree } from '@/utils/postCache'

/** 상세는 «없는 글/권한 없는 글»이 정상 경로다 — 404·403 은 재시도해도 결과가 같다. */
function retryUnlessTerminal(count: number, err: unknown) {
  const status = (err as { response?: { status?: number } })?.response?.status
  return status !== 404 && status !== 403 && count < 1
}

/**
 * 게시글 상세.
 *
 * ⚠ 이 호출 «자체»가 부수효과다 — state=ACT 이면 매 호출마다 view_logs 를 1건 insert 한다
 *   (docs/api/05-post-read.md:218). 그래서
 *   ① 화면에서 POST /post/read 를 추가로 부르지 않고,
 *   ② 창 포커스·재마운트로 재조회하지 않으며,
 *   ③ 변경 동작 뒤에도 **invalidate 하지 않고 캐시를 직접 패치**한다.
 *   실측: invalidate 로 재조회하니 공감 한 번에 조회수가 28→29 로 올랐다.
 */
export function usePostDetail(postId: string | undefined) {
  const { i18n } = useTranslation()
  return useQuery({
    // ⚠ 캐시 키에 언어를 «넣지 않는다». 넣으면 언어를 바꿀 때마다 데이터 없는 새 키가 되어
    //   staleTime:Infinity 를 우회해 재요청이 나가고, 그 호출이 view_logs 를 1건 더 넣는다
    //   (ko→en→ko 로 조회수 +2). lang 은 헤더로만 쓰여 «에러 메시지 로케일»만 바꾸고
    //   응답 본문 필드를 바꾸지 않는다(services/postService.ts getPost).
    queryKey: ['post', postId],
    queryFn: () => getPost(postId!, i18n.language),
    enabled: !!postId && isAuthenticated(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: retryUnlessTerminal,
  })
}

/**
 * 상세 화면의 변경 동작. **상세 쿼리를 invalidate 하지 않는다**(위 주석 ③).
 * 목록·공지는 부수효과가 없으므로 무효화한다 — 댓글 수·공감 수·북마크가 목록 컬럼에 실린다.
 *
 * ⚠ 서버의 `comment_count`/`like_count` 는 비동기 큐라(§0 #7) 응답 시점에 최신이 아니다.
 *   그래서 화면 숫자는 이 패치 결과에서 «직접 세어» 쓴다(utils/postComments).
 */
export function usePostDetailMutations(postId: string | undefined) {
  const qc = useQueryClient()
  const key = ['post', postId]

  const patch = (fn: (p: PostDetail) => PostDetail) => {
    qc.setQueriesData<PostDetail>({ queryKey: key }, (prev) => (prev ? fn(prev) : prev))
    qc.invalidateQueries({ queryKey: ['posts'] })
    qc.invalidateQueries({ queryKey: ['notices'] })
  }

  return {
    addComment: useMutation({
      mutationFn: (v: { comment: string; parentCommentId?: string }) =>
        insertComment(postId!, v.comment, v.parentCommentId),
      onSuccess: (created, v) =>
        patch((p) => ({
          ...p,
          comments: appendComment(p.comments ?? [], created, v.parentCommentId),
        })),
    }),

    editComment: useMutation({
      mutationFn: (v: { commentId: string; comment: string }) =>
        updateComment(v.commentId, v.comment),
      onSuccess: (updated, v) =>
        patch((p) => ({
          ...p,
          comments: mapCommentTree(p.comments ?? [], v.commentId, (c) => ({
            ...c,
            comment: updated.comment,
            updated_at: updated.updated_at,
          })),
        })),
    }),

    // 삭제는 hard delete 가 아니다 — is_active=false + comment 가 null 로 마스킹된다(07:230).
    // 자식 대댓글은 연쇄 삭제되지 않으므로 그대로 남긴다.
    removeComment: useMutation({
      mutationFn: (commentId: string) => deleteComment(commentId),
      onSuccess: (_r, commentId) =>
        patch((p) => ({
          ...p,
          comments: mapCommentTree(p.comments ?? [], commentId, (c) => ({
            ...c,
            is_active: false,
            comment: null,
          })),
        })),
    }),

    reactPost: useMutation({
      mutationFn: (emoji: string) => togglePostLike(postId!, emoji),
      onSuccess: (res) =>
        patch((p) => ({
          ...p,
          likes: applyToggle(p.likes, res, (emoji) => ({ emoji, count: 1, is_reacted: 1 })),
        })),
    }),

    reactComment: useMutation({
      mutationFn: (v: { commentId: string; emoji: string }) =>
        toggleCommentLike(v.commentId, v.emoji),
      onSuccess: (res, v) =>
        patch((p) => ({
          ...p,
          comments: mapCommentTree(p.comments ?? [], v.commentId, (c) => ({
            ...c,
            likes: applyToggle(c.likes, res, (emoji) => ({
              emoji,
              count: 1,
              is_reacted: 1,
              comment_id: v.commentId,
            })),
          })),
        })),
    }),

    // ⚠ 북마크 응답(PostBookmark)엔 timestamps 가 없어 «응답만으로 현재 상태를 알 수 없다»
    //   (docs/api/06-post-write.md §9). 상세를 재조회하면 조회수가 오르므로 토글 규약을 믿고
    //   로컬로 뒤집는다. 다음 진입 때 서버의 is_bookmark($appends)가 정본으로 덮는다.
    bookmark: useMutation({
      mutationFn: () => togglePostBookmark(postId!),
      onSuccess: () => patch((p) => ({ ...p, is_bookmark: !p.is_bookmark })),
    }),

    removePost: useMutation({
      mutationFn: () => deletePost(postId!),
      onSuccess: () => {
        qc.removeQueries({ queryKey: key })
        qc.invalidateQueries({ queryKey: ['posts'] })
        qc.invalidateQueries({ queryKey: ['notices'] })
      },
    }),
  }
}
