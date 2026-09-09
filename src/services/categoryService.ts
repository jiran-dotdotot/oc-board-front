// Go 카테고리 트리. docs/api/go/03-category.md:150-247.
import {
  deleteBoardResource,
  getBoardResource,
  postBoardResource,
  putBoardResource,
} from '@/lib/boardApi'
import { serializeParams } from '@/lib/queryParams'
import type {
  Category,
  CategoryCreatePayload,
  CategoryDetail,
  CategoryTree,
  CategoryTreeReorderPayload,
  CategoryTreeReorderResult,
  CategoryUpdatePayload,
} from '@/types/category'

// with_category_admin=1 → 내가 카테고리 관리자인 카테고리(+하위)까지 포함.
// 이 query는 문자열로 ""/"0"만 false이므로 켤 때 1을 보낸다.
export async function selectCategory(lang: string): Promise<CategoryTree> {
  const { data } = await getBoardResource<CategoryTree>('/categories', {
    params: { with_category_admin: 1 },
    paramsSerializer: { serialize: serializeParams },
    headers: { lang },
  })
  return data
}

// 회사 관리자는 전체 트리, 그 외는 멤버+카테고리 관리자 범위다.
// 두 분기 모두 BoardView의 개인 알림·권한 플래그를 포함한다.
export async function selectAdminCategory(lang: string): Promise<CategoryTree> {
  const { data } = await getBoardResource<CategoryTree>('/categories/admin', {
    headers: { lang },
  })
  return data
}

/**
 * 내가 «관리»하는 트리. 직접 관리 카테고리와 그 자식, 직접 게시판 관리자의 카테고리와
 * 이들을 붙일 부모까지가 후보이고 **활성 카테고리만** 나온다.
 * ⚠️ 봉투가 아니라 `CategoryView[]` **직접 배열**이고 **공용 게시판은 포함되지 않는다**.
 * ⚠️ 회사 관리자라고 회사 전체 트리를 주지 않는다(03-category.md:288) → 회사 관리자는
 *    `/categories/admin` 을 쓴다.
 */
export async function selectManagementCategory(lang: string): Promise<Category[]> {
  const { data } = await getBoardResource<Category[]>('/categories/management', {
    headers: { lang },
  })
  return data
}

/** 카테고리 상세 — grant 3종. `boards`·`child_categories`·개인 알림은 이 응답에 없다. */
export async function selectCategoryDetail(id: string, lang: string): Promise<CategoryDetail> {
  const { data } = await getBoardResource<CategoryDetail>(`/categories/${id}`, {
    headers: { lang },
  })
  return data
}

/** 카테고리 생성. root 는 회사 관리자만. 이미 자식인 부모를 지정하면 422. */
export async function createCategory(payload: CategoryCreatePayload): Promise<void> {
  await postBoardResource('/categories', payload)
}

/** 카테고리 수정. `{}` 는 아무것도 바꾸지 않는다. `parent_category_id` 는 무시된다. */
export async function updateCategory(id: string, payload: CategoryUpdatePayload): Promise<void> {
  await putBoardResource(`/categories/${id}`, payload)
}

/**
 * 카테고리 삭제(204). **직속 자식과 그 게시판·게시글·첨부·자료실 파일까지 soft-delete** 되고
 * 복원 API 는 없다(03-category.md:502) → 확인 모달에서 영향 범위를 반드시 알린다.
 */
export async function deleteCategory(id: string): Promise<void> {
  await deleteBoardResource(`/categories/${id}`)
}

/**
 * 카테고리·게시판 순서 저장. **바뀐 항목만** 보낸다.
 * 응답 `reordered` 는 UPDATE 매치 행 수이므로 사용자에게 개수로 보여주지 않는다.
 * 게시판 관리자만인 사용자는 이 API 자체가 403 이다(02-management.md:433).
 */
export async function reorderCategoryTree(
  payload: CategoryTreeReorderPayload,
): Promise<CategoryTreeReorderResult> {
  const { data } = await putBoardResource<CategoryTreeReorderResult>('/category-tree', payload)
  return data
}
