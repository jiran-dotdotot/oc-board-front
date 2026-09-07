// 자료실 파일 API 서비스. GET /api/v1/drive/file (selectDriveFile).
import { apiClient } from '@/lib/apiClient'
import { serializeParams } from '@/lib/queryParams'
import type {
  ApiDriveFile,
  DriveBoard,
  DriveCallbackBody,
  DriveFileListParams,
  DriveFilePage,
  DriveFolder,
  DrivePresignFile,
  DrivePresignItem,
} from '@/types/drive'
import axios from 'axios'

// 자료실 한 화면치 폴더 정보 — 현재 레벨 폴더 + 전체 트리 + 브레드크럼(path) +
// 용량(total_usage_size) + 권한(is_writable/is_admin) 이 한 번에 온다. 파일은 별도(/drive/file).
export async function getDrive(
  boardId: string,
  folderId: string | undefined,
  lang: string,
): Promise<DriveBoard> {
  const { data } = await apiClient.get<DriveBoard>(`/drive/${boardId}`, {
    params: { drive_folder_id: folderId },
    paramsSerializer: { serialize: serializeParams },
    headers: { lang },
  })
  return data
}

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

// 「최근 자료」 목록 — 페이지네이션이 필요해 selectDriveFiles 와 갈라 둔다.
// selectDriveFiles 는 is_not_paging=1 을 강제해 «배열»을 주므로 페이지 정보를 얻을 수 없다.
// (postService 의 selectPost ↔ selectNotices 와 같은 분리)
export async function selectDriveFilePage(
  params: DriveFileListParams,
  lang: string,
): Promise<DriveFilePage> {
  // DriveFileListParams 를 그대로 받으니 필드를 조용히 버리면 안 된다 —
  // 호출부는 넘긴 값이 먹었다고 믿는다(빈 값은 serializeParams 가 알아서 뺀다).
  const q: Record<string, unknown> = {
    board_id: params.board_id,
    drive_folder_id: params.drive_folder_id,
    category_id: params.category_id,
    user_id: params.user_id,
    user_name: params.user_name,
    search: params.search,
    title: params.title,
    start_posted_at: params.start_posted_at, // 실제로는 created_at 필터
    end_posted_at: params.end_posted_at,
    limit_day: params.limit_day,
    more_field: params.more_field ?? 'board',
    take: params.take ?? 20,
    page: params.page ?? 1,
  }
  // 루트 파일만 = drive_folder_id 를 서버가 null 로 강제. 폴더 진입 시엔 켜면 안 된다.
  if (params.is_drive_root) q.is_drive_root = 1
  if (params.is_public_only) q.is_public_only = 1
  const sort = params.sort ?? { by: 'created_at', order: 'desc' }
  q['sort[by]'] = sort.by
  q['sort[order]'] = sort.order

  const { data } = await apiClient.get<DriveFilePage>('/drive/file', {
    params: q,
    paramsSerializer: { serialize: serializeParams },
    headers: { lang },
  })
  return data
}

// 파일 북마크 토글. 응답(DriveFileBookmark)만으로는 최종 상태 판단이 애매해
// (추가·해제 모두 200) 목록의 is_bookmark 를 정본으로 삼고 무효화한다 — docs/api/09 §8.
export async function toggleDriveFileBookmark(fileId: string): Promise<void> {
  await apiClient.post(`/drive/file/bookmark/${fileId}`)
}

// 파일 다건 삭제 → 휴지통(state=DEL). 응답은 «업데이트된 행 수»(정수).
// ⚠ DELETE /drive/file 은 «내 파일만» 이라 관리자가 남의 파일을 못 지운다 → board 라우트를 쓴다
//   (관리자면 남의 것도, 아니면 내 것만 — docs/api/09-drive-file.md §7). 레거시도 같은 선택.
export async function deleteDriveFiles(boardId: string, ids: string[]): Promise<number> {
  const { data } = await apiClient.delete<number>(`/drive/file/board/${boardId}`, {
    data: { id: ids },
  })
  return data
}

// 폴더 다건 삭제. 응답은 «실제로 지워진 id 배열» — 못 지운 건 조용히 빠진다(하위가 있으면 스킵).
// 폴더는 휴지통이 없다(하드 삭제).
export async function deleteDriveFolders(boardId: string, ids: string[]): Promise<string[]> {
  const { data } = await apiClient.delete<string[]>(`/drive/folder/board/${boardId}`, {
    data: { id: ids },
  })
  return data ?? []
}

// ① 다중 presign 발급. ⚠ 일부/전부 실패해도 HTTP 200 — 원소별 result.state 로 판정할 것.
//    파일 배열은 최대 10개(11개 이상이면 400).
export async function getDrivePresignedUrls(
  boardId: string,
  files: DrivePresignFile[],
  folderId: string | undefined,
  lang: string,
): Promise<DrivePresignItem[]> {
  const { data } = await apiClient.post<DrivePresignItem[]>(
    `/drive/pre-signed-url/multiple/${boardId}`,
    { files, drive_folder_id: folderId ?? null },
    { headers: { lang } },
  )
  return data ?? []
}

// ② S3 직접 PUT. presign URL 에 SigV4 서명이 들어 있어 Authorization 헤더를 «붙이면 안 된다»
//    → apiClient(인터셉터가 토큰을 붙임)가 아니라 생 axios 를 쓴다. 유효기간 1시간.
export async function putFileToS3(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  await axios.put(url, file, {
    headers: {
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    },
    onUploadProgress(e) {
      onProgress(e.total ? Math.round((e.loaded * 100) / e.total) : 0)
    },
  })
}

// ③ 업로드 확정. PUT 이 200 을 받은 «뒤에» 호출해야 한다(아니면 서버가 size 조회 실패로 500).
//    성공 판정은 HTTP 코드가 아니라 응답의 state === 'ACT'.
export async function postDriveCallback(body: DriveCallbackBody): Promise<ApiDriveFile> {
  const { data } = await apiClient.post<ApiDriveFile>('/drive/callback', body)
  return data
}

// 폴더 생성. company_id/category_id/board_id/user_id/position 은 서버가 계산한다(보내도 무시).
// parent 를 안 주면 최상위 폴더가 된다.
export async function createDriveFolder(
  boardId: string,
  title: string,
  parentFolderId: string | undefined,
  lang: string,
): Promise<DriveFolder> {
  const { data } = await apiClient.post<DriveFolder>(
    `/drive/folder/${boardId}`,
    { title, parent_drive_folder_id: parentFolderId ?? null },
    { headers: { lang } },
  )
  return data
}

// 폴더 이름 변경. fillable 은 title/position 뿐이라 **이 API 로 폴더 이동은 불가**하다.
export async function renameDriveFolder(
  folderId: string,
  title: string,
  lang: string,
): Promise<DriveFolder> {
  const { data } = await apiClient.put<DriveFolder>(
    `/drive/folder/${folderId}`,
    { title },
    { headers: { lang } },
  )
  return data
}
