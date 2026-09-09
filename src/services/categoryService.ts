// Go 카테고리 트리. docs/api/go/03-category.md:150-247.
import { getBoardResource } from '@/lib/boardApi'
import { serializeParams } from '@/lib/queryParams'
import type { CategoryTree } from '@/types/category'

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
