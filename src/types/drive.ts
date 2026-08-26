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
