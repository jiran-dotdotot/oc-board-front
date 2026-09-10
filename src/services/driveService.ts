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
  DriveRestoreResult,
  MyDriveFileListParams,
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

// ─── 내 활동 목록 (docs/api/go/09-drive-file.md:233 · :289) ────────────────

/**
 * 내 자료 목록. 내 자료(ACT)와 휴지통(DEL)이 `state` 로만 갈린다.
 *
 * ⚠ `state` 는 **필수**다 — 없으면 조회조차 하지 않고 200 빈 봉투가 온다(09:253).
 * ⚠ `is_bookmark` 를 절대 보내지 않는다 — `is_bookmark=0` «만» 보내면 **400** 이고(09:178),
 *   `"false"`·`"00"` 는 북마크 분기다(09:251). 북마크는 전용 경로로만 간다.
 * 본인 분기는 board Read·활성 여부를 검사하지 않는다 → 목록에 보여도 상세/다운로드는 403 일 수 있다(09:265·275).
 */
export async function selectMyDriveFiles(
  params: MyDriveFileListParams,
  lang: string,
): Promise<DriveFilePage> {
  const { data } = await getBoardResource<DriveFilePage>('/drive-files/mine', {
    params: { state: params.state, take: params.take ?? 20, page: params.page ?? 1 },
    paramsSerializer: { serialize: serializeParams },
    headers: { lang },
  })
  return data
}

/**
 * 북마크한 자료. 서버가 ACT·살아 있는 파일로 강제하고 is_bookmark 를 무시한다(09:303).
 * 여기는 게시글 북마크와 달리 **Read·활성 게이트가 있다** — 권한을 잃으면 data 와 total 에서
 * 조용히 빠진다(09:311). 북마크한 «시각» 순 정렬은 제공되지 않는다(09:323).
 */
export async function selectBookmarkedDriveFiles(
  params: { take?: number; page?: number },
  lang: string,
): Promise<DriveFilePage> {
  const { data } = await getBoardResource<DriveFilePage>('/drive-files/bookmarks', {
    params: { take: params.take ?? 20, page: params.page ?? 1 },
    paramsSerializer: { serialize: serializeParams },
    headers: { lang },
  })
  return data
}

// ─── 내 활동 일괄 쓰기 (docs/api/go/09-drive-file.md:423 · :469) ────────────

/** 영구 삭제. **업로더만** — 관리자 특례가 없다. 살아 있는 ACT 는 대상이 아니다(09:445). */
export async function purgeDriveFiles(ids: string[]): Promise<DriveBulkResult> {
  const { data } = await deleteBoardResource<DriveBulkResult>('/drive-files/purge', { ids })
  return { affected: data?.affected ?? 0, ignored_ids: data?.ignored_ids ?? [] }
}

/**
 * 복원. **업로더만**, 살아 있는 게시판의 휴지통 파일만(09:491).
 * ⚠ 응답이 삭제·purge 와 모양이 다르다 — 용량 초과는 422 가 아니라 200 + fail_drive 로 온다(09:497).
 *   그리고 그 배열은 **게시판 ID** 다(09:182).
 */
export async function restoreDriveFiles(ids: string[]): Promise<DriveRestoreResult> {
  const { data } = await postBoardResource<DriveRestoreResult>('/drive-files/restore', { ids })
  return {
    affected: data?.affected ?? 0,
    ignored_ids: data?.ignored_ids ?? [],
    success_drive: data?.success_drive ?? [],
    success_count: data?.success_count ?? 0,
    fail_drive: data?.fail_drive ?? [],
    fail_count: data?.fail_count ?? 0,
  }
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
