// 게시판 쓰기 payload. 근거: docs/api/go/04-board.md:376-397(POST) · :445-468(PUT).
import type { BoardType } from './category'

/**
 * `POST {S}/boards` — `type`·`title` 필수, 200(201 아님).
 * `category_id: null` 은 **공용 게시판**이고 회사 관리자만 만들 수 있다.
 * `is_public`·`is_drive` 는 검증만 하고 아무 효과가 없어 보내지 않는다.
 */
export interface BoardCreatePayload {
  type: BoardType
  title: string
  category_id?: string | null
  /** 생략하면 ALL. 「조직 지정」은 MEMBER 다 — 04-board.md:52 의 판정표 참조. */
  read_permission?: 'ALL' | 'ADMIN' | 'MEMBER'
  /** 공용 게시판(`category_id: null`)에서는 서버가 grant 3종을 무시한다. */
  insert_board_department_id?: number[]
  insert_board_member_user_id?: number[]
  insert_board_admin_user_id?: number[]
  description?: string
  is_active?: boolean
  is_post_alarm?: boolean
  is_notice_alarm?: boolean
  position?: number
  // DRIVE 만. non-DRIVE 에 양수 용량·확장자를 남기면 422 BOARD_DRIVE_BOUNDARY.
  size_limit?: number | null
  size_limit_per_file?: number | null
  except_extension?: string[]
}

/**
 * `PUT {S}/boards/{id}` — 생략은 유지.
 * ⚠️ **추가 키는 400**이고 `category_id`·`is_comment_alarm` 도 400 이다.
 * ⚠️ 최종 타입이 non-DRIVE 인데 `size_limit*` 키를 «이름만» 보내도 422 다 →
 *    자료실일 때만 그 키를 싣는다.
 */
export interface BoardUpdatePayload {
  type?: BoardType
  title?: string
  description?: string
  is_active?: boolean
  is_post_alarm?: boolean
  is_notice_alarm?: boolean
  position?: number
  size_limit?: number | null
  size_limit_per_file?: number | null
  except_extension?: string[]
  read_permission?: 'ALL' | 'ADMIN' | 'MEMBER'
  insert_board_department_id?: number[]
  insert_board_member_user_id?: number[]
  insert_board_admin_user_id?: number[]
  delete_board_admin_user_id?: number[]
  delete_board_member_user_id?: number[]
  delete_board_department_id?: number[]
}
