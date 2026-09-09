// 상세 패널 초안 → Go 쓰기 payload. 순수함수다(단위 테스트 대상).
import type { NodeDraft, SettingsNode } from '@/components/settings/types'
import type { BoardUpdatePayload } from '@/types/board'
import type { CategoryUpdatePayload } from '@/types/category'

/** 트리 노드 → 초안. 트리 응답에 편집 대상 스칼라가 전부 실려 오므로 동기적으로 만든다. */
export function draftOf(node: SettingsNode): NodeDraft {
  const b = node.board
  return {
    name: node.name,
    type: b?.type ?? 'BOARD',
    is_active: b ? b.is_active !== false : node.category?.is_active !== false,
    is_post_alarm: b?.is_post_alarm !== false,
    size_limit: b?.size_limit ?? null,
    size_limit_per_file: b?.size_limit_per_file ?? null,
    except_extension: b?.except_extension ?? [],
  }
}

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i])

/**
 * **바뀐 필드만** 담은 `PUT {S}/boards/{id}` payload.
 *
 * 세 가지 이유로 전체를 보내지 않는다:
 * 1. 최종 타입이 non-DRIVE 인데 `size_limit*` 키를 «이름만» 실어도 **422
 *    BOARD_DRIVE_BOUNDARY** 다(04-board.md:244) → 자료실일 때만 싣는다.
 * 2. 추가 키는 **400**이고 `category_id`·`is_comment_alarm` 도 400 이다(04-board.md:468).
 * 3. 값이 같아도 키를 보내면 `updated_at` 이 갱신된다.
 *
 * ⚠️ `is_notice_alarm`(게시판 전체 공지 알림)은 정본 상세 패널에 컨트롤이 없어
 *    **보내지 않는다** → 서버 값이 그대로 유지된다. 레거시에는 이 스위치가 있었다.
 */
export function boardUpdatePatch(orig: NodeDraft, draft: NodeDraft): BoardUpdatePayload {
  const patch: BoardUpdatePayload = {}
  if (draft.name !== orig.name) patch.title = draft.name
  if (draft.type !== orig.type) patch.type = draft.type
  if (draft.is_active !== orig.is_active) patch.is_active = draft.is_active
  if (draft.is_post_alarm !== orig.is_post_alarm) patch.is_post_alarm = draft.is_post_alarm

  if (draft.type === 'DRIVE') {
    if (draft.size_limit !== orig.size_limit) patch.size_limit = draft.size_limit
    if (draft.size_limit_per_file !== orig.size_limit_per_file)
      patch.size_limit_per_file = draft.size_limit_per_file
    if (!sameList(draft.except_extension, orig.except_extension))
      patch.except_extension = draft.except_extension
  }
  return patch
}

/** **바뀐 필드만** 담은 `PUT {S}/categories/{id}` payload. */
export function categoryUpdatePatch(
  orig: { name: string; is_active: boolean },
  draft: { name: string; is_active: boolean },
): CategoryUpdatePayload {
  const patch: CategoryUpdatePayload = {}
  if (draft.name !== orig.name) patch.name = draft.name
  if (draft.is_active !== orig.is_active) patch.is_active = draft.is_active
  return patch
}

/** 보낼 것이 하나도 없는 패치인지. `{}` 를 보내면 서버는 200 이지만 아무 의미가 없다. */
export function isEmptyPatch(patch: object): boolean {
  return Object.keys(patch).length === 0
}
