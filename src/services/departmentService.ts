// 조직도 조회. 관리 도메인이라 경로에 `user_id` 세그먼트가 없다.
import { getCompanyResource } from '@/lib/boardApi'
import type { DepartmentNode } from '@/types/department'

/**
 * `GET {company}/departments` — 회사 조직도 **전체 트리 하나**.
 * `categoryId` 를 주면 그 카테고리의 공개 범위로 가지치기해서 준다(빈 하위 가지 제거,
 * 루트는 인원 0이어도 반환). 빈 문자열·`0` 은 필터 없음이고 불량 UUID 는 400 이다
 * (docs/api/go/10-upload-department-client.md:288,311).
 * 루트가 없으면 서버가 **빈 Body** 를 준다 → `null` 로 정규화한다.
 */
export async function selectDepartments(
  categoryId: string | null,
  lang: string,
): Promise<DepartmentNode | null> {
  const { data } = await getCompanyResource<DepartmentNode | ''>('/departments', {
    params: categoryId ? { category_id: categoryId } : undefined,
    headers: { Lang: lang },
  })
  return data && typeof data === 'object' && 'id' in data ? data : null
}
