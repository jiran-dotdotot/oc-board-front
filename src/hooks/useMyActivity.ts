import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { type ChipKey, type MyTab, buildMyListParams } from '@/components/mypage/myParams'
import { isAuthenticated } from '@/lib/authStorage'
import {
  deleteDriveFiles,
  purgeDriveFiles,
  restoreDriveFiles,
  selectBookmarkedDriveFiles,
  selectMyDriveFiles,
} from '@/services/driveService'
import {
  deletePosts,
  purgePosts,
  restorePosts,
  selectBookmarkedPosts,
  selectMyPosts,
} from '@/services/postService'
import type { ApiDriveFile } from '@/types/drive'
import type { Paginated, Post } from '@/types/post'

/** 두 도메인의 목록이 같은 봉투를 쓰므로 화면은 한 모양만 본다. */
export type MyPage = Paginated<Post> | Paginated<ApiDriveFile>

/**
 * 내 활동 목록. 칩 × 탭이 어느 엔드포인트로 가는지는 `buildMyListParams` 하나가 정한다 —
 * 훅은 그 결정을 실행만 한다(요청 조립을 두 군데 두면 반드시 갈라진다).
 */
export function useMyList(chip: ChipKey, tab: MyTab, page: number, take: number) {
  const { i18n } = useTranslation()
  const plan = buildMyListParams(chip, tab, page, take)
  const lang = i18n.language
  return useQuery<MyPage>({
    // path 를 키에 넣는다 — 칩이 달라도 같은 파라미터가 나오는 조합이 있다(내 글/휴지통 × 탭).
    queryKey: [plan.kind === 'post' ? 'my-posts' : 'my-drive-files', plan.path, plan.params, lang],
    queryFn: () => {
      switch (plan.path) {
        case '/posts/mine':
          return selectMyPosts(plan.params, lang)
        case '/posts/bookmarks':
          return selectBookmarkedPosts(plan.params, lang)
        case '/drive-files/mine':
          return selectMyDriveFiles(plan.params, lang)
        case '/drive-files/bookmarks':
          return selectBookmarkedDriveFiles(plan.params, lang)
      }
    },
    placeholderData: keepPreviousData,
    enabled: isAuthenticated(),
  })
}

/** 카운트 한 건. 봉투의 `total` 만 보므로 `take=1` 이고 60초 동안 재사용한다. */
function useCountQuery(
  key: string,
  lang: string,
  enabled: boolean,
  fn: () => Promise<{ total: number }>,
) {
  return useQuery({ queryKey: ['my-counts', key, lang], queryFn: fn, staleTime: 60_000, enabled })
}

/**
 * 홈 「해야 할 일」·/my 임시저장·예약 칩이 공유하는 2건. 쿼리키가 같아 두 화면이 한 캐시를 본다.
 * 서버 집계가 없어 `take=1` 목록의 `total` 로 센다(BR-038).
 */
export function useMyTodoCounts(): { draft: number; schedule: number } {
  const { i18n } = useTranslation()
  const lang = i18n.language
  const enabled = isAuthenticated()
  const one = { take: 1, page: 1 } as const
  const drafts = useCountQuery('posts-save', lang, enabled, () =>
    selectMyPosts({ state: 'SAVE', ...one }, lang),
  )
  const sched = useCountQuery('posts-scheduled', lang, enabled, () =>
    selectMyPosts({ state: 'SCHEDULED', ...one }, lang),
  )
  return { draft: drafts.data?.total ?? 0, schedule: sched.data?.total ?? 0 }
}

/**
 * 칩 5종의 카운트 + 프로필 통계. 정본은 **모든 칩에 숫자**를 붙인다(개선안 통합 앱.dc.html:1086).
 * 봉투의 `total` 만 필요하므로 전부 `take=1` 이다.
 *
 * ⚠ 그래서 진입 시 카운트 전용 요청이 7건 나간다. Go 에 사용자별 집계 엔드포인트가 없어
 *   목록 API 를 세는 것 말고 방법이 없다(BR-038). 서버가 집계를 주면 한 건으로 줄어든다.
 * 「댓글」 타일은 만들지 않는다 — 사용자별 댓글 수는 Go 어디에도 없다(BR-038).
 */
export function useMyCounts(): Record<ChipKey, number> {
  const { i18n } = useTranslation()
  const lang = i18n.language
  const enabled = isAuthenticated()
  const one = { take: 1, page: 1 } as const

  const mine = useCountQuery('posts-act', lang, enabled, () =>
    selectMyPosts({ state: 'ACT', ...one }, lang),
  )
  const todo = useMyTodoCounts()
  const trashP = useCountQuery('posts-del', lang, enabled, () =>
    selectMyPosts({ state: 'DEL', ...one }, lang),
  )
  const trashF = useCountQuery('files-del', lang, enabled, () =>
    selectMyDriveFiles({ state: 'DEL', ...one }, lang),
  )
  const bmP = useCountQuery('posts-bm', lang, enabled, () => selectBookmarkedPosts(one, lang))
  const bmF = useCountQuery('files-bm', lang, enabled, () => selectBookmarkedDriveFiles(one, lang))
  const n = (r: { data?: { total: number } }) => r.data?.total ?? 0

  return {
    // 「중요」·「휴지통」은 두 도메인 합이다 — 서버가 주는 값이 아니라 우리 정의다(가정 원장).
    important: n(bmP) + n(bmF),
    my: n(mine),
    draft: todo.draft,
    schedule: todo.schedule,
    trash: n(trashP) + n(trashF),
  }
}

/**
 * 하위탭(게시글·자료) 각각의 카운트. 두 도메인이 다 있는 칩(중요·내 글·휴지통)에서만 뜻이 있다.
 * `useMyCounts` 와 **같은 queryKey** 를 써 캐시를 공유하므로 추가 요청은 `files-act` 하나뿐이다
 * (내 글 자료 탭용). 이걸로 활성/비활성 두 탭 «둘 다» 숫자를 보여 준다 — 정본은 탭에도 카운트를 붙인다.
 */
export function useMyTabCounts(chip: ChipKey): { post: number; file: number } | null {
  const { i18n } = useTranslation()
  const lang = i18n.language
  const enabled = isAuthenticated()
  const one = { take: 1, page: 1 } as const
  const bmP = useCountQuery('posts-bm', lang, enabled, () => selectBookmarkedPosts(one, lang))
  const bmF = useCountQuery('files-bm', lang, enabled, () => selectBookmarkedDriveFiles(one, lang))
  const trashP = useCountQuery('posts-del', lang, enabled, () =>
    selectMyPosts({ state: 'DEL', ...one }, lang),
  )
  const trashF = useCountQuery('files-del', lang, enabled, () =>
    selectMyDriveFiles({ state: 'DEL', ...one }, lang),
  )
  const mineP = useCountQuery('posts-act', lang, enabled, () =>
    selectMyPosts({ state: 'ACT', ...one }, lang),
  )
  const mineF = useCountQuery('files-act', lang, enabled, () =>
    selectMyDriveFiles({ state: 'ACT', ...one }, lang),
  )
  const n = (r: { data?: { total: number } }) => r.data?.total ?? 0
  switch (chip) {
    case 'important':
      return { post: n(bmP), file: n(bmF) }
    case 'trash':
      return { post: n(trashP), file: n(trashF) }
    case 'my':
      return { post: n(mineP), file: n(mineF) }
    default:
      return null // 임시저장·예약은 게시글 전용 — 하위탭이 없다
  }
}

/**
 * 휴지통 이동 · 복원 · 영구삭제.
 *
 * 배치는 항상 «동종»이다 — 탭이 게시글/자료를 갈라 놓으므로 한 요청에 두 도메인이 섞이지 않는다.
 * ⚠ 전건 거절도 200 이다. 성공 여부는 `affected`/`ignored_ids` 로만 알 수 있고 사유는 구분되지 않는다
 *   (06:344 · 09:506). 그래서 결과 보고는 「N개 처리 · M개 제외」까지만 한다.
 * ⚠ `['post', id]` 상세 캐시는 **무효화하지 않는다** — GET /posts/{id} 가 매 호출 조회수를 올린다.
 */
export function useMyMutations(kind: 'post' | 'file') {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['my-posts'] })
    qc.invalidateQueries({ queryKey: ['my-drive-files'] })
    qc.invalidateQueries({ queryKey: ['my-counts'] })
    qc.invalidateQueries({ queryKey: ['posts'] })
    qc.invalidateQueries({ queryKey: ['drive-file-page'] })
  }
  const isPost = kind === 'post'

  const trash = useMutation({
    mutationFn: (ids: string[]) => (isPost ? deletePosts(ids) : deleteDriveFiles(ids)),
    onSuccess: invalidate,
  })
  const purge = useMutation({
    mutationFn: (ids: string[]) => (isPost ? purgePosts(ids) : purgeDriveFiles(ids)),
    onSuccess: invalidate,
  })
  // 자료 복원만 응답이 6필드다(용량 초과 → 200 + fail_count). 호출부가 그 필드를 읽는다.
  const restore = useMutation({
    mutationFn: (ids: string[]) => (isPost ? restorePosts(ids) : restoreDriveFiles(ids)),
    onSuccess: invalidate,
  })
  return { trash, purge, restore }
}
