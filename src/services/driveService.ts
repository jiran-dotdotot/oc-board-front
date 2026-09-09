// 자료실 API 서비스 — 전부 Go 스코프 경로(docs/api/go/08·09·10).
// 옛 /api/v1/drive/** prefix 는 Go 에 없다(go/README.md:196) — 호환 rewrite 대상도 아니다.
import {
  deleteBoardResource,
  getBoardResource,
  postBoardResource,
  putBoardResource,
} from '@/lib/boardApi'
import { serializeParams } from '@/lib/queryParams'
import type {
  ApiDriveFile,
  DriveBoard,
  DriveBulkResult,
  DriveDownloadUrl,
  DriveFileListParams,
  DriveFilePage,
  DriveFolder,
  DrivePresignFile,
  DrivePresignItem,
} from '@/types/drive'
import axios from 'axios'

// 자료실 한 화면치 — 현재 레벨 폴더 + 전체 트리 + 브레드크럼(path) + 용량(total_usage_size)
// + 게시판 객체(board: 권한·확장자·파일당 상한). 파일 목록은 별도(/drive-files).
// ⚠ 자료실이 아닌 게시판이면 422 BOARD_NOT_DRIVE 다(08:262 §5).
export async function getDrive(
  boardId: string,
  folderId: string | undefined,
  lang: string,
): Promise<DriveBoard> {
  const { data } = await getBoardResource<DriveBoard>(`/boards/${boardId}/drive`, {
    params: { drive_folder_id: folderId },
    paramsSerializer: { serialize: serializeParams },
    headers: { lang },
  })
  return data
}

/**
 * 자료실 파일 목록. 목록은 항상 «페이지 봉투»다.
 * ⚠ is_not_paging 을 보내지 않는다 — 문서(09:108·215)는 배열을 준다고 하지만 실서버는
 *   1/true 어느 값이든 봉투를 준다(2026-09-09 실측, BR-004). 애초에 비페이징도 page
 *   offset·최대 100을 유지해서 «전체 파일» 요청이 아니다(09:108).
 */
export async function selectDriveFiles(
  params: DriveFileListParams,
  lang: string,
): Promise<DriveFilePage> {
  // DriveFileListParams 를 그대로 받으니 필드를 조용히 버리면 안 된다 —
  // 호출부는 넘긴 값이 먹었다고 믿는다(빈 값은 serializeParams 가 알아서 뺀다).
  const q: Record<string, unknown> = {
    board_id: params.board_id,
    drive_folder_id: params.drive_folder_id,
    category_id: params.category_id,
    user_name: params.user_name,
    search: params.search,
    title: params.title,
    start_posted_at: params.start_posted_at, // 실제로는 created_at 필터
    end_posted_at: params.end_posted_at,
    limit_day: params.limit_day,
    take: params.take ?? 20,
    page: params.page ?? 1,
  }
  // Go 루트 조건은 folder 필터와 AND다. 폴더 진입 시엔 켜면 안 된다(09:125-126).
  if (params.is_drive_root) q.is_drive_root = 1
  if (params.is_public_only) q.is_public_only = 1
  const sort = params.sort ?? { by: 'created_at', order: 'desc' }
  q['sort[by]'] = sort.by
  q['sort[order]'] = sort.order
  if (sort.value) q['sort[value]'] = sort.value

  const { data } = await getBoardResource<DriveFilePage>('/drive-files', {
    params: q,
    paramsSerializer: { serialize: serializeParams },
    headers: { lang },
  })
  return data
}

// 파일 북마크 토글. 응답 필드는 목록의 is_bookmark 가 아니라 **is_bookmarked** 다(09:557).
// 재요청은 상태를 유지하지 않고 다시 뒤집는다.
export async function toggleDriveFileBookmark(fileId: string): Promise<boolean> {
  const { data } = await postBoardResource<{ is_bookmarked: boolean }>(
    `/drive-files/${fileId}/bookmark`,
  )
  return data.is_bookmarked
}

// 파일 다건 삭제 → 휴지통(deleted_at 기록, state 는 그대로).
// ⚠ 부분 실패도 200 이다 — 거절·없는·이미 휴지통은 ignored_ids 로만 온다(09:407).
export async function deleteDriveFiles(ids: string[]): Promise<DriveBulkResult> {
  const { data } = await deleteBoardResource<DriveBulkResult>('/drive-files', { ids })
  return { affected: data?.affected ?? 0, ignored_ids: data?.ignored_ids ?? [] }
}

// 폴더 다건 삭제. 응답은 «실제로 지워진 id 배열» — 못 지운 건 조용히 빠진다(08:232).
// 폴더는 휴지통이 없다(하드 삭제).
export async function deleteDriveFolders(ids: string[]): Promise<string[]> {
  const { data } = await deleteBoardResource<string[]>('/folders', { ids })
  return data ?? []
}

// ① 다중 presign 발급. ⚠ 일부/전부 실패해도 HTTP 200 — 원소별 result.state 로 판정할 것.
//    파일 배열은 최대 10개(11개 이상이면 400). 응답은 요청 순서를 유지하며 파일명을
//    echo 하지 않으므로 로컬 File 과 «인덱스»로 짝짓는다(10:186).
export async function getDrivePresignedUrls(
  boardId: string,
  files: DrivePresignFile[],
  folderId: string | undefined,
  lang: string,
): Promise<DrivePresignItem[]> {
  const { data } = await postBoardResource<DrivePresignItem[]>(
    `/boards/${boardId}/drive-uploads`,
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

// ③ 업로드 확정. PUT 이 성공한 «뒤에» 호출한다. Body 는 비어도 된다 — 서버는 경로 id 와
//    DB 에 저장한 key 만 쓰고 file_id/object_key 를 보내도 무시한다(10:229).
//    성공 판정은 HTTP 코드가 아니라 응답의 state === 'ACT' 다.
export async function completeDriveUpload(fileId: string): Promise<ApiDriveFile> {
  const { data } = await postBoardResource<ApiDriveFile>(
    `/drive-files/${fileId}/upload-complete`,
    {},
  )
  return data
}

// 다운로드 URL(5분 presign). ⚠ Go 응답에는 src/object_key 가 없다 — 클라이언트가 공개
// S3 주소를 조립하지 않는다(09:185 · 05:45). ACT 가 아니면 409 FILE_NOT_ACTIVE.
export async function getDriveFileDownloadUrl(fileId: string): Promise<DriveDownloadUrl> {
  const { data } = await getBoardResource<DriveDownloadUrl>(`/drive-files/${fileId}/download-url`)
  return data
}

// 게시글 첨부 다운로드 URL. 자료실과 «다른» 엔드포인트이며 id 는 post id 가 아니라 첨부 id 다(05:495).
export async function getAttachmentDownloadUrl(attachmentId: string): Promise<DriveDownloadUrl> {
  const { data } = await getBoardResource<DriveDownloadUrl>(
    `/attachments/${attachmentId}/download-url`,
  )
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
  const { data } = await postBoardResource<DriveFolder>(
    `/boards/${boardId}/folders`,
    { title, parent_id: parentFolderId ?? null },
    { headers: { lang } },
  )
  return data
}

// 폴더 이름 변경. ⚠ 생성과 달리 **추가 키 불허**다 — parent_drive_folder_id 를 보내면
//    400 INVALID_PAYLOAD. 이동은 parent_id 로 한다(08:180).
export async function renameDriveFolder(
  folderId: string,
  title: string,
  lang: string,
): Promise<DriveFolder> {
  const { data } = await putBoardResource<DriveFolder>(
    `/folders/${folderId}`,
    { title },
    { headers: { lang } },
  )
  return data
}
