// 자료실 파일 API 서비스. GET /api/v1/drive/file (selectDriveFile).
import { apiClient } from '@/lib/apiClient'
import { serializeParams } from '@/lib/queryParams'
import type { ApiDriveFile, DriveFileListParams } from '@/types/drive'

// 자료실 화면은 플랫 목록 → is_not_paging=1 (배열 반환), more_field=board(게시판 관계 포함).
export async function selectDriveFiles(
  params: DriveFileListParams,
  lang: string,
): Promise<ApiDriveFile[]> {
  const q: Record<string, unknown> = {
    board_id: params.board_id,
    drive_folder_id: params.drive_folder_id,
    category_id: params.category_id,
    user_id: params.user_id,
    user_name: params.user_name,
    search: params.search,
    title: params.title,
    start_posted_at: params.start_posted_at,
    end_posted_at: params.end_posted_at,
    limit_day: params.limit_day,
    more_field: params.more_field ?? 'board',
    limit: params.limit ?? 100,
    is_not_paging: 1,
  }
  // bool은 켤 때만 1 (백엔드 raw truthiness — "false" 문자열도 참으로 평가되는 이슈 회피)
  if (params.is_public_only) q.is_public_only = 1
  if (params.is_drive_root) q.is_drive_root = 1
  const sort = params.sort ?? { by: 'created_at', order: 'desc' }
  q['sort[by]'] = sort.by
  q['sort[order]'] = sort.order
  if (sort.value) q['sort[value]'] = sort.value

  const { data } = await apiClient.get<ApiDriveFile[]>('/drive/file', {
    params: q,
    paramsSerializer: { serialize: serializeParams },
    headers: { lang },
  })
  return data
}
