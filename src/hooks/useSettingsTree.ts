import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useTranslation } from 'react-i18next'

import { useMe } from '@/hooks/useMe'
import { isAuthenticated } from '@/lib/authStorage'
import { createBoard, deleteBoard, selectBoardDetail, updateBoard } from '@/services/boardService'
import {
  createCategory,
  deleteCategory,
  reorderCategoryTree,
  selectAdminCategory,
  selectCategoryDetail,
  selectManagementCategory,
  updateCategory,
} from '@/services/categoryService'
import type { BoardCreatePayload, BoardUpdatePayload } from '@/types/board'
import type {
  CategoryCreatePayload,
  CategoryTree,
  CategoryTreeReorderPayload,
  CategoryUpdatePayload,
} from '@/types/category'

/**
 * 「게시판 관리」 트리.
 * - 회사 관리자 → `GET {S}/categories/admin` (공용 게시판 포함)
 * - 그 외 → `GET {S}/categories/management` (**직접 배열**, 공용 게시판 없음)
 * 레거시도 같은 분기였다(`order.vue:53-57`). 두 응답을 `CategoryTree` 모양으로 맞춰 준다.
 *
 * queryKey 는 `['categories', ...]` 프리픽스를 공유해 CRUD 후 사이드바 트리까지 한 번에
 * 무효화된다.
 */
export function useSettingsTree() {
  const { i18n } = useTranslation()
  const { data: me } = useMe()
  const isOfficeAdmin = !!me?.is_admin
  return useQuery<CategoryTree>({
    queryKey: ['categories', isOfficeAdmin ? 'admin' : 'management', i18n.language],
    queryFn: async () => {
      if (isOfficeAdmin) return selectAdminCategory(i18n.language)
      const categories = await selectManagementCategory(i18n.language)
      // `/categories/management` 는 공용 게시판을 주지 않는다 — 없는 것을 만들지 않는다.
      return { public_boards: [], categories }
    },
    // me 가 오기 전에 조회하면 관리자인데 좁은 트리를 캐싱한다.
    enabled: isAuthenticated() && !!me,
    staleTime: 5 * 60 * 1000,
  })
}

/** 게시판 상세(grant·사용량). 트리에는 grant 가 없다. */
export function useBoardDetail(boardId: string | null) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['board-detail', boardId, i18n.language],
    queryFn: () => selectBoardDetail(boardId!, i18n.language),
    enabled: isAuthenticated() && !!boardId,
  })
}

/** 카테고리 상세(grant). */
export function useCategoryDetail(categoryId: string | null) {
  const { i18n } = useTranslation()
  return useQuery({
    queryKey: ['category-detail', categoryId, i18n.language],
    queryFn: () => selectCategoryDetail(categoryId!, i18n.language),
    enabled: isAuthenticated() && !!categoryId,
  })
}

/** 트리를 바꾸는 모든 쓰기. 성공 시 트리와 상세를 함께 무효화한다. */
export function useSettingsTreeMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['categories'] })
    qc.invalidateQueries({ queryKey: ['board-detail'] })
    qc.invalidateQueries({ queryKey: ['category-detail'] })
  }
  const opts = { onSuccess: invalidate }

  return {
    createBoard: useMutation({
      mutationFn: (payload: BoardCreatePayload) => createBoard(payload),
      ...opts,
    }),
    updateBoard: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: BoardUpdatePayload }) =>
        updateBoard(id, payload),
      ...opts,
    }),
    deleteBoard: useMutation({ mutationFn: (id: string) => deleteBoard(id), ...opts }),
    createCategory: useMutation({
      mutationFn: (payload: CategoryCreatePayload) => createCategory(payload),
      ...opts,
    }),
    updateCategory: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: CategoryUpdatePayload }) =>
        updateCategory(id, payload),
      ...opts,
    }),
    deleteCategory: useMutation({ mutationFn: (id: string) => deleteCategory(id), ...opts }),
    reorder: useMutation({
      mutationFn: (payload: CategoryTreeReorderPayload) => reorderCategoryTree(payload),
      ...opts,
    }),
  }
}
