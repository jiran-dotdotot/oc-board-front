// 자료실 파일 목록 API 타입 (GET /api/v1/drive/file — selectDriveFile)
import type { Paginated, PostBoard, PostUser } from '@/types/post'

// drive.drive_files 필드 (관계: user 항상, board는 more_field=board 시)
export interface ApiDriveFile {
  id: string
  user_id: number
  company_id: number
  category_id: string | null
  board_id: string
  drive_folder_id: string | null
  state: string
  position: number
  src: string // S3 오브젝트 키
  origin_file_name: string
  size: number // bytes
  extension: string
  delete_user_id: number | null
  upload_expire_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  user?: PostUser
  board?: PostBoard
  // $appends — 매 응답에 항상 포함(docs/api/09-drive-file.md:39). 현재 유저 기준 북마크 여부.
  is_bookmark?: boolean
}

// 폴더 한 칸 (GET /drive/{board} 의 drive_folders[] · child_drive_folders[]).
// ⚠ 트리(child_drive_folders)에서는 id/parent_drive_folder_id/title/child_drive_folders 만 신뢰할 것
//   — 레벨별로 필드가 불균일하다(docs/api/08-drive-folder.md §6 주의사항).
export interface DriveFolder {
  id: string
  parent_drive_folder_id: string | null
  title: string
  user_id?: number
  created_at?: string
  user?: PostUser
  last_drive_folder_log?: { created_at?: string; user?: PostUser } | null
  child_drive_folders?: DriveFolder[]
  is_open?: boolean
}

// GET /drive/{board} — 게시판 객체 + 폴더/용량/권한 필드. 파일 목록은 포함되지 않는다.
export interface DriveBoard {
  id: string
  title: string
  is_drive?: boolean
  size_limit?: number // 0 이면 무제한
  size_limit_per_file?: number // 0 이면 전역 3GiB
  except_extension?: string[] // 대문자
  total_usage_size: number // ACT 파일 합계(byte)
  is_writable: boolean
  is_admin: boolean
  drive_folders: DriveFolder[] // 현재 레벨 폴더
  child_drive_folders: DriveFolder[] // 전체 트리
  path: { id: string; title: string }[] // 브레드크럼(루트→현재). folder 미지정이면 []
}

export interface DriveFileListParams {
  board_id?: string
  drive_folder_id?: string
  category_id?: string
  user_id?: number
  user_name?: string
  search?: string
  title?: string
  start_posted_at?: string // 실제로는 created_at 필터
  end_posted_at?: string
  limit_day?: number
  sort?: { by: string; order: 'asc' | 'desc'; value?: string }
  more_field?: string // 'board' | '*' 이면 board 관계 포함
  take?: number
  page?: number
  is_not_paging?: boolean
  limit?: number
  is_public_only?: boolean
  is_drive_root?: boolean
}

export type DriveFilePage = Paginated<ApiDriveFile>

// ── 업로드 3단계 (docs/api/10-drive-upload-department-live.md) ──────────────
// presign 발급 → 브라우저가 S3 에 직접 PUT → callback 으로 확정.

export interface DrivePresignFile {
  file_name: string
  extension: string // 점 제외
  size: number // byte
}

// ⚠ 다중 presign 은 «실패해도 HTTP 200». 성공/실패는 원소별 result.state 로만 판정한다.
export type DrivePresignResult =
  | { state: 'success'; file_id: string; object_key: string; url: string }
  | { state: 'fail'; message: string }

export interface DrivePresignItem extends DrivePresignFile {
  result: DrivePresignResult
}

export interface DriveCallbackBody {
  file_id: string
  object_key: string
}
