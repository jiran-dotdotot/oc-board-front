// 카테고리 API 서비스. GET /api/v1/category (selectCategory).
import { apiClient } from '@/lib/apiClient'
import { serializeParams } from '@/lib/queryParams'
import type { CategoryTree } from '@/types/category'

// with_category_admin=1 → 내가 카테고리 관리자인 카테고리(+하위)까지 포함.
// 일반 유저에겐 no-op이라 항상 켜 둔다. (raw truthiness 평가라 반드시 1)
export async function selectCategory(lang: string): Promise<CategoryTree> {
  const { data } = await apiClient.get<CategoryTree>('/category', {
    params: { with_category_admin: 1 },
    paramsSerializer: { serialize: serializeParams },
    headers: { lang },
  })
  return data
}

// office 관리자 전용: 회사 전체 트리(멤버십 필터 없음).
// ⚠ 서버가 is_active 필터를 걸지 않아 비활성 카테고리/게시판도 내려온다 → utils/category에서 거른다.
// ⚠ 관리자 분기 응답에는 is_board_member_*_alarm / is_category_admin 필드가 없다.
export async function selectAdminCategory(lang: string): Promise<CategoryTree> {
  const { data } = await apiClient.get<CategoryTree>('/category/admin', {
    headers: { lang },
  })
  return data
}
