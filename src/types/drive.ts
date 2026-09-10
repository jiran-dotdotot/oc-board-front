// Go 파일 목록 DTO에서 사용하는 필드. docs/api/go/09-drive-file.md:51-79.
import type { Paginated, PostBoard, PostUser } from '@/types/post'

// user/board 관계는 기본 포함이며 null일 수 있다. src/position은 Go 응답에 없다.
export interface ApiDriveFile {
  id: string
  user_id: number | null
  company_id: number
  category_id: string | null
  board_id: string
  drive_folder_id: string | null
  state: string
  origin_file_name: string
  size: number // bytes
  extension: string
  delete_user_id: number | null
  upload_expire_at: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  user?: PostUser | null
  /** 삭제자(09:77). PostUser 와 달리 account 가 없는 SignalUserView 지만 이름만 쓴다. */
  delete_user?: PostUser | null
  board?: PostBoard | null
  // 현재 유저의 live 북마크 여부.
  is_bookmark?: boolean
}

// 폴더 한 칸 (GET /boards/{id}/drive 의 drive_folders[] · child_drive_folders[] · path[]).
// ⚠ parent_id 와 parent_drive_folder_id 는 같은 값을 담아 둘 다 온다(실측 2026-09-09).
//   이동/생성 입력은 parent_id 다 — 이름 변경 PUT 은 parent_drive_folder_id 를 거절한다(08:180).
export interface DriveFolder {
  id: string
  parent_id: string | null
  parent_drive_folder_id: string | null
  title: string
  board_id?: string
  position?: number
  user_id?: number | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
  updated_by?: number | null
  updated_by_at?: string | null
  user?: PostUser | null
  child_drive_folders?: DriveFolder[]
  is_open?: boolean
}

// 자료실 화면이 쓰는 게시판 메타. GET /boards/{id}/drive 응답의 `board` 관계로 온다 —
// ⚠ is_writable · except_extension · size_limit_per_file 은 **최상위가 아니라 여기** 있다
//   (실측 2026-09-09). 최상위에 있다고 읽으면 조용히 undefined 다.
export interface DriveBoardMeta {
  id: string
  title: string
  type?: string
  is_drive?: boolean
  is_writable?: boolean
  is_admin?: boolean
  can_manage?: boolean
  is_bookmark?: boolean
  size_limit?: number | null
  size_limit_per_file?: number | null
  except_extension?: string[]
}

// GET /api/v1/board/companies/{c}/users/{u}/boards/{id}/drive — 폴더/용량/권한.
// 파일 목록은 포함되지 않는다(/drive-files 별도). 자료실이 아니면 422 BOARD_NOT_DRIVE.
export interface DriveBoard {
  id: string
  title: string
  is_admin: boolean
  board?: DriveBoardMeta | null
  size_limit?: number | null // null 이면 무제한
  total_usage_size: number // ACT 파일 합계(byte)
  drive_folders: DriveFolder[] // 현재 레벨 폴더
  child_drive_folders: DriveFolder[] // 전체 트리
  path: DriveFolder[] // 브레드크럼(루트→현재). folder 미지정이면 []
}

export interface DriveFileListParams {
  board_id?: string
  drive_folder_id?: string
  category_id?: string
  user_name?: string
  search?: string
  title?: string
  start_posted_at?: string // 실제로는 created_at 필터
  end_posted_at?: string
  limit_day?: number
  sort?: { by: string; order: 'asc' | 'desc'; value?: string }
  take?: number
  page?: number
  is_public_only?: boolean
  is_drive_root?: boolean
}

export type DriveFilePage = Paginated<ApiDriveFile>

// ── 업로드 3단계 (docs/api/go/10-upload-department-client.md) ───────────────
// presign 발급 → 브라우저가 S3 에 직접 PUT → upload-complete 로 확정.

export interface DrivePresignFile {
  file_name: string
  extension: string // 점 제외, 영숫자 1~16자 (점을 붙이면 400)
  size: number // byte
}

// ⚠ 다중 presign 은 «실패해도 HTTP 200». 성공/실패는 원소별 result.state 로만 판정한다.
//   해당 없는 키는 null 이 아니라 «생략»된다(10:33).
export type DrivePresignResult =
  { state: 'success'; file_id: string; url: string } | { state: 'fail'; message: string }

// ⚠ 응답은 file_name/extension/size 를 echo 하지 않는다 — 로컬 File 과 인덱스로 짝짓는다(10:186).
export interface DrivePresignItem {
  result: DrivePresignResult
}

// 일괄 쓰기 공통 응답. 부분 실패도 200 이라 여기로만 결과를 안다(09:407).
export interface DriveBulkResult {
  affected: number
  ignored_ids: string[]
}

/**
 * 파일 조회 쿼리의 `state` — 하드 enum 이다. 그 외 값은 **400**(09:129).
 * 게시글과 달리 응답의 `state` 에는 `DEL` 이 «오지 않는다» — 삭제 여부는 `deleted_at` 으로 본다(09:180).
 */
export type DriveQueryState = 'UPLOADING' | 'FAIL' | 'ACT' | 'DEL'

/**
 * GET .../drive-files/mine 쿼리(09:233-257) 중 우리가 쓰는 것만.
 *
 * ⚠ `state` 는 **필수**다. 없으면 조회조차 하지 않고 200 빈 봉투가 온다(09:253).
 * ⚠ `is_bookmark` 를 넣지 않는다. `is_bookmark=0` «만» 보내면 400 이고(09:178),
 *   `"false"`·`"00"` 는 북마크 분기다(09:251). 북마크는 `/drive-files/bookmarks` 전용 경로로만 간다.
 */
export interface MyDriveFileListParams {
  state: DriveQueryState
  take?: number
  page?: number
}

/**
 * 파일 복원 응답(09:499-506). 삭제·영구삭제(2필드)와 **모양이 다르다**.
 * ⚠ `success_drive`/`fail_drive` 는 파일 ID 가 아니라 **게시판 ID** 이고,
 *   count 는 그 게시판 안의 «파일 수»다(09:182). 행 하이라이트에 쓰면 엉뚱한 걸 칠한다.
 * 용량 초과는 422 가 아니라 200 + fail_drive 로 온다(09:497).
 */
export interface DriveRestoreResult extends DriveBulkResult {
  /** 용량 판정을 통과한 «게시판» ID */
  success_drive: string[]
  success_count: number
  /** 용량 초과로 거절된 «게시판» ID */
  fail_drive: string[]
  fail_count: number
}

// 다운로드 URL 발급 응답(TTL 5분). 자료실·게시글 첨부가 같은 모양이다(09:604 · 05:521).
export interface DriveDownloadUrl {
  url: string
  origin_file_name: string
  expires_at: string
}
