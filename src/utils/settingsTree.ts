// 환경 설정 트리의 순수 함수. 컴포넌트에서 분리해 단위 테스트 대상으로 둔다.
import { PUBLIC_CAT_ID } from '@/components/settings/types'
import type { DropPos, NodeKind, SettingsNode } from '@/components/settings/types'
import type { Category, CategoryBoard, CategoryTree } from '@/types/category'
import { isDriveBoard } from '@/types/category'

/** 트리 들여쓰기(px) — 정본 `padL`. */
export const TREE_PAD = [10, 28, 46] as const

interface Perm {
  /** 회사(오피스) 관리자. */
  isOfficeAdmin: boolean
}

/**
 * Go 카테고리 트리 → 화면 행. 순서는 정본과 같다:
 * 「공용」(회사 관리자 + 공용 게시판이 있을 때) → 카테고리 → 자식 카테고리와 그 게시판 →
 * 카테고리 직속 게시판.
 */
export function flattenSettingsTree(
  tree: CategoryTree | undefined,
  perm: Perm,
  publicLabel: string,
): SettingsNode[] {
  const out: SettingsNode[] = []
  if (!tree) return out

  // 공용 게시판은 카테고리 «행»이 아니라 category_id=null 묶음이다 → 고정 가상 노드로 묶는다.
  if (tree.public_boards.length > 0) {
    out.push({
      kind: 'cat',
      id: PUBLIC_CAT_ID,
      name: publicLabel,
      depth: 0,
      position: 0,
      paused: false,
      scoped: false,
      parentCat: null,
      parentFolder: null,
      canManage: false,
      canDelete: false,
      fixed: true,
    })
    for (const b of tree.public_boards) {
      // 공용 게시판의 생성·삭제는 회사 관리자만이다(04-board.md:524).
      out.push(boardNode(b, 1, PUBLIC_CAT_ID, null, perm.isOfficeAdmin))
    }
  }

  for (const cat of tree.categories) {
    out.push(categoryNode(cat, 0, null, perm, cat.is_admin))
    for (const child of cat.child_categories ?? []) {
      // 자식의 관리 권한은 부모 관리자도 갖는다(CanManage = 본인/부모 1홉).
      out.push(categoryNode(child, 1, cat.id, perm, cat.is_admin))
      for (const b of child.boards ?? []) {
        out.push(boardNode(b, 2, cat.id, child.id, canDeleteBoard(b, perm)))
      }
    }
    for (const b of cat.boards ?? []) {
      out.push(boardNode(b, 1, cat.id, null, canDeleteBoard(b, perm)))
    }
  }
  return out
}

/** 게시판 삭제는 **회사 관리자 또는 카테고리 관리자**만이다 — `can_manage` 보다 좁다. */
function canDeleteBoard(b: CategoryBoard, perm: Perm): boolean {
  return perm.isOfficeAdmin || !!b.is_category_admin
}

function boardNode(
  b: CategoryBoard,
  depth: 0 | 1 | 2,
  parentCat: string | null,
  parentFolder: string | null,
  canDelete: boolean,
): SettingsNode {
  return {
    kind: isDriveBoard(b) ? 'drive' : 'board',
    id: b.id,
    name: b.title,
    depth,
    position: b.position,
    paused: b.is_active === false,
    scoped: b.read_permission !== 'ALL',
    parentCat,
    parentFolder,
    canManage: !!b.can_manage,
    canDelete,
    board: b,
  }
}

function categoryNode(
  c: Category,
  depth: 0 | 1,
  parentCat: string | null,
  perm: Perm,
  parentIsAdmin: boolean | undefined,
): SettingsNode {
  // CanManage = 회사 관리자 OR 본인/부모 카테고리 관리자(03-category.md:130).
  // 삭제 권한도 같은 집합이다(03-category.md:490).
  const can = perm.isOfficeAdmin || !!c.is_admin || (depth === 1 && !!parentIsAdmin)
  return {
    kind: depth === 0 ? 'cat' : 'folder',
    id: c.id,
    name: c.name,
    depth,
    position: c.position,
    paused: c.is_active === false,
    scoped: false,
    parentCat,
    parentFolder: null,
    canManage: can,
    canDelete: can,
    category: c,
  }
}

/**
 * 순서 변경이 허용되는 짝인지. **같은 형제 그룹 안에서만** 이동한다 —
 * 정본 `dndSame` 과 같고, Go `PUT category-tree` 도 position 만 바꾸며
 * parent 이동을 하지 않으므로(docs/api/go/02-management.md:447) 계약과도 일치한다.
 */
export function dndSame(a: SettingsNode | null, b: SettingsNode): boolean {
  if (!a || a.id === b.id) return false
  const isItem = (k: NodeKind) => k === 'board' || k === 'drive'
  // 「공용」 가상 노드는 실제 행이 아니라 순서를 바꿀 수 없다.
  if (a.fixed || b.fixed) return false
  if (a.kind === 'cat' && b.kind === 'cat') return true
  if (a.kind === 'folder' && b.kind === 'folder') return a.parentCat === b.parentCat
  if (isItem(a.kind) && isItem(b.kind))
    return a.parentCat === b.parentCat && a.parentFolder === b.parentFolder
  return false
}

/** 배열에서 `fromId` 를 떼어 `toId` 의 앞/뒤로 옮긴 새 배열. */
export function reorder<T extends { id: string }>(
  arr: T[],
  fromId: string,
  toId: string,
  pos: DropPos,
): T[] {
  const a = arr.slice()
  const from = a.findIndex((x) => x.id === fromId)
  if (from < 0) return arr
  const [moved] = a.splice(from, 1)
  let to = a.findIndex((x) => x.id === toId)
  if (to < 0) return arr
  if (pos === 'after') to += 1
  a.splice(to, 0, moved)
  return a
}

/* ── 용량 라벨 ↔ byte ──
   정본은 칩(`100MB/500MB/1GB`·`5GB/10GB/50GB`)이지만 Go 는 byte int64 를 받는다
   (04-board.md:82-84). 레거시는 임의 MB 입력이라 칩에 없는 값이 이미 저장돼 있을 수 있다. */

const MB = 1024 * 1024
const GB = 1024 * MB

/** `'500MB'` → byte. 알 수 없는 형식이면 null(= 제한 없음). */
export function labelToBytes(label: string): number | null {
  const m = /^(\d+(?:\.\d+)?)(MB|GB)$/.exec(label.trim())
  if (!m) return null
  return Math.round(Number(m[1]) * (m[2] === 'GB' ? GB : MB))
}

/** byte → 칩 라벨. 정수로 딱 떨어지지 않으면 소수 한 자리까지 보여준다. */
export function bytesToLabel(bytes: number): string {
  const unit = bytes >= GB ? GB : MB
  const n = bytes / unit
  const shown = Number.isInteger(n) ? String(n) : n.toFixed(1)
  return `${shown}${unit === GB ? 'GB' : 'MB'}`
}

/**
 * 표시할 용량 칩 목록. 현재 값이 정본 칩에 없으면 **그 값을 칩으로 덧붙인다** —
 * 칩만 두면 레거시가 임의 입력으로 만든 값(예: 250MB)이 저장 시 조용히 바뀐다.
 */
export function capOptions(current: number | null | undefined, presets: string[]): string[] {
  if (current == null || current <= 0) return presets
  const label = bytesToLabel(current)
  return presets.includes(label) ? presets : [...presets, label]
}

/**
 * 형제들의 새 순서 → `{id: position}` 패치. **바뀐 항목만** 담는다.
 *
 * position 값은 형제들이 **이미 갖고 있던 값을 정렬해 재사용**한다. 배열 인덱스+1 로
 * 새로 만들지 않는 이유: 비회사관리자는 `/categories/management` 로 **부분 트리**만 받는데,
 * 부분 목록의 인덱스로 전역 position 을 만들면 안 보이는 형제와 충돌한다
 * (레거시 `order.vue:215` 가 정확히 이 버그다).
 */
export function positionPatch(
  siblings: { id: string; position: number }[],
): Record<string, number> {
  const slots = siblings.map((s) => s.position).sort((a, b) => a - b)
  const patch: Record<string, number> = {}
  siblings.forEach((s, i) => {
    if (slots[i] !== s.position) patch[s.id] = slots[i]
  })
  return patch
}
