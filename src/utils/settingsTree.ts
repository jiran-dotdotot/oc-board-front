// 환경 설정 트리의 순수 함수. 컴포넌트에서 분리해 단위 테스트 대상으로 둔다.
import { TREE_PAD } from '@/components/settings/constants'
import type { Cat, DropPos, Folder, Item, NodeKind, TreeNode } from '@/components/settings/types'

/** 카테고리 → 폴더 → (폴더 안 게시판) → 카테고리 직속 게시판 순으로 평탄화한다(정본 순서). */
export function flattenTree(cats: Cat[], folders: Folder[], items: Item[]): TreeNode[] {
  const out: TreeNode[] = []
  for (const cat of cats) {
    out.push({
      kind: 'cat',
      id: cat.id,
      name: cat.name,
      pad: TREE_PAD.cat,
      paused: false,
      scoped: cat.scope === 'org',
      cat: null,
      folder: null,
    })
    for (const f of folders.filter((x) => x.cat === cat.id)) {
      out.push({
        kind: 'folder',
        id: f.id,
        name: f.name,
        pad: TREE_PAD.child,
        paused: false,
        scoped: f.scope === 'org',
        cat: cat.id,
        folder: null,
      })
      for (const it of items.filter((x) => x.folder === f.id)) {
        out.push(leaf(it, TREE_PAD.leaf, cat.id, f.id))
      }
    }
    for (const it of items.filter((x) => x.cat === cat.id && !x.folder)) {
      out.push(leaf(it, TREE_PAD.child, cat.id, null))
    }
  }
  return out
}

function leaf(it: Item, pad: number, cat: string, folder: string | null): TreeNode {
  return {
    kind: it.type,
    id: it.id,
    name: it.name,
    pad,
    paused: !it.active,
    scoped: it.scope === 'org',
    cat,
    folder,
  }
}

/**
 * 순서 변경이 허용되는 짝인지. **같은 형제 그룹 안에서만** 이동한다 —
 * 정본 `dndSame` 과 같고, Go `PUT category-tree` 도 position 만 바꾸며
 * parent 이동을 하지 않으므로(docs/api/go/02-management.md:447) 계약과도 일치한다.
 */
export function dndSame(a: TreeNode | null, b: TreeNode): boolean {
  if (!a || a.id === b.id) return false
  const isItem = (k: NodeKind) => k === 'board' || k === 'drive'
  if (a.kind === 'cat' && b.kind === 'cat') return true
  if (a.kind === 'folder' && b.kind === 'folder') return a.cat === b.cat
  if (isItem(a.kind) && isItem(b.kind)) return a.cat === b.cat && a.folder === b.folder
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

/** 같은 형제 안에서 한 칸 이동(키보드 대체 경로). 끝을 넘으면 원본을 그대로 돌려준다. */
export function nudge<T extends { id: string }>(arr: T[], id: string, delta: -1 | 1): T[] {
  const i = arr.findIndex((x) => x.id === id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= arr.length) return arr
  const a = arr.slice()
  ;[a[i], a[j]] = [a[j], a[i]]
  return a
}
