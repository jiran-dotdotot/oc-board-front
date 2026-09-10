import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { isAuthenticated } from '@/lib/authStorage'
import {
  createPost,
  deleteComment,
  deletePost,
  getPost,
  insertComment,
  toggleCommentLike,
  togglePostBookmark,
  togglePostLike,
  updateComment,
  updatePost,
} from '@/services/postService'
import type { PostDetail, PostUpdateBody, PostWriteBody } from '@/types/post'
import { appendComment, applyToggle, mapCommentTree } from '@/utils/postCache'

/** 서버가 삭제를 전건 거부(200 affected=0)했을 때의 표식 — 「실패」와 「권한 없음」을 구분한다. */
export const DELETE_REJECTED = 'POST_DELETE_REJECTED'

/** 상세는 «없는 글/권한 없는 글»이 정상 경로다 — 404·403 은 재시도해도 결과가 같다. */
function retryUnlessTerminal(count: number, err: unknown) {
  const status = (err as { response?: { status?: number } })?.response?.status
  return status !== 404 && status !== 403 && count < 1
}

/**
 * 게시글 상세.
 *
 * ⚠ 이 호출 «자체»가 부수효과다 — state=ACT 이면 매 호출마다 view_logs 를 1건 insert 한다
 *   (docs/api/go/05-post-read.md:42). 그래서
 *   ① 화면에서 POST /post/read 를 추가로 부르지 않고,
 *   ② 창 포커스·재마운트로 재조회하지 않으며,
 *   ③ 변경 동작 뒤에도 **invalidate 하지 않고 캐시를 직접 패치**한다.
 *   실측: invalidate 로 재조회하니 공감 한 번에 조회수가 28→29 로 올랐다.
 */
export function usePostDetail(postId: string | undefined) {
  const { i18n } = useTranslation()
  return useQuery({
    // ⚠ 캐시 키에 언어를 «넣지 않는다». 넣으면 언어를 바꿀 때마다 데이터 없는 새 키가 되어
    //   staleTime:Infinity 를 우회해 재요청이 나가고, 그 호출이 열람을 1건 더 기록한다
    //   (ko→en→ko 로 조회수 +2 — docs/api/go/05-post-read.md:42).
    //   알려진 한계: `Lang` 은 «에러 메시지»만 바꾸는 게 아니라 표시 이름 뒤의 퇴직/중지
    //   접미사도 바꾼다(같은 문서 :13·:83·:90). 그래서 언어를 바꿔도 이전 언어의 「(퇴직)」이
    //   남는다. 조회수 부수효과가 더 크다고 보고 키를 고정한다 — 새로고침하면 맞춰진다.
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

    // 응답 `is_bookmarked` 가 «토글 이후» 상태의 정본이다(docs/api/go/06-post-write.md:140·:537).
    // 캐시값을 로컬 반전하면 캐시가 어긋났을 때 아이콘이 서버와 반대로 굳는다.
    bookmark: useMutation({
      mutationFn: () => togglePostBookmark(postId!),
      onSuccess: (isBookmarked) => patch((p) => ({ ...p, is_bookmark: isBookmarked })),
    }),

    // ⚠ 전부 거절돼도 200 `{affected:0, ignored_ids:[id]}` 다(docs/api/go/06-post-write.md:41·:344).
    //   삭제 허용은 «작성자»뿐이라 관리자가 남의 글을 지우면 이 경로로 온다 — 성공으로 흘리면
    //   글이 남은 채 목록으로 이탈해 사용자는 지워졌다고 믿는다. onError 로 보낸다.
    removePost: useMutation({
      mutationFn: async () => {
        if (!(await deletePost(postId!))) throw new Error(DELETE_REJECTED)
        return true
      },
      onSuccess: () => {
        qc.removeQueries({ queryKey: key })
        qc.invalidateQueries({ queryKey: ['posts'] })
        qc.invalidateQueries({ queryKey: ['notices'] })
      },
    }),
  }
}

/**
 * 글 작성·수정. 성공 후 목록·공지만 invalidate 한다 — 상세 캐시는 «화면»이 정리한다:
 *  - 발행/수정 후 상세로 이동: `qc.removeQueries(['post', id])` 뒤 이동 → 상세가 1회 읽는다
 *    (ACT 글이면 조회수 +1 — 레거시도 같다). write 응답에 badges/files/thumbnail 관계가 없어
 *    (06-post-write.md:90) 캐시 «패치»로는 화면을 완성할 수 없다(BR-042).
 *  - 임시저장 뒤 머무름: `invalidateQueries(['post', id])` — SAVE/SCHEDULED 는 열람을 기록하지 않는다
 *    (05-post-read.md:474) 라 뱃지 id 등을 안전하게 다시 받는다.
 */
export function usePostWriteMutations() {
  const qc = useQueryClient()
  const settle = () => {
    qc.invalidateQueries({ queryKey: ['posts'] })
    qc.invalidateQueries({ queryKey: ['notices'] })
  }
  return {
    create: useMutation({
      mutationFn: (v: { boardId: string; body: PostWriteBody }) => createPost(v.boardId, v.body),
      onSuccess: settle,
    }),
    update: useMutation({
      mutationFn: (v: { postId: string; body: PostUpdateBody }) => updatePost(v.postId, v.body),
      onSuccess: settle,
    }),
  }
}
