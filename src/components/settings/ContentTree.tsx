import { useState } from 'react'

import { useTranslation } from 'react-i18next'

import type { DropPos, NodeKind, SettingsNode } from './types'
import { NodeIcon } from './ui'
import { ScopedIcon } from '@/components/common/icons'
import { TREE_PAD, dndSame } from '@/utils/settingsTree'

/**
 * 좌측 트리 카드. 순서 변경은 **같은 형제 그룹 안에서만** 허용한다(`dndSame`) —
 * Go `PUT category-tree` 도 position 만 바꾸고 부모 이동을 하지 않는다.
 *
 * 접근성: 드래그는 마우스 전용이라 **Alt+↑/↓ 로 같은 일을 할 수 있게** 열어 뒀다.
 * 깊이가 들여쓰기(시각)로만 전달되던 것은 `aria-level` 로 보강한다.
 */
export function ContentTree({
  nodes,
  selId,
  onSelect,
  onMove,
  note,
  emptyText,
}: {
  nodes: SettingsNode[]
  selId: string | null
  onSelect: (node: SettingsNode) => void
  /** 드래그·키보드 모두 이 하나로 모인다. */
  onMove: (node: SettingsNode, targetId: string, pos: DropPos) => void
  note: string
  emptyText: string
}) {
  const { t } = useTranslation()
  const [dragItem, setDragItem] = useState<SettingsNode | null>(null)
  const [dragOver, setDragOver] = useState<{ id: string; pos: DropPos } | null>(null)

  const clearDrag = () => {
    setDragItem(null)
    setDragOver(null)
  }

  /** 같은 형제 중 한 칸 위/아래 노드로 옮긴다(키보드 경로). */
  const nudge = (node: SettingsNode, dir: -1 | 1) => {
    const siblings = nodes.filter((n) => dndSame(node, n) || n.id === node.id)
    const i = siblings.findIndex((n) => n.id === node.id)
    const target = siblings[i + dir]
    if (!target) return
    onMove(node, target.id, dir === -1 ? 'before' : 'after')
  }

  if (nodes.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-card p-6 text-center text-s text-gray-500">
        {emptyText}
      </div>
    )
  }

  return (
    <div
      role="tree"
      aria-label={note}
      className="flex flex-col gap-px rounded-lg border border-gray-200 bg-card p-2"
    >
      {nodes.map((n) => {
        const on = selId === n.id
        const canDrop = dndSame(dragItem, n)
        const draggable = !n.fixed && n.canManage
        return (
          <button
            key={`${n.kind}-${n.id}`}
            type="button"
            role="treeitem"
            aria-level={n.depth + 1}
            aria-selected={on}
            draggable={draggable}
            onClick={() => onSelect(n)}
            onKeyDown={(e) => {
              // Alt+↑/↓ — 드래그의 키보드 대체. Alt 를 쓰는 이유는 ↑/↓ 만으로는
              // 트리 «이동»(포커스)과 «순서 변경»이 구분되지 않기 때문이다.
              if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
              if (!draggable) return
              e.preventDefault()
              nudge(n, e.key === 'ArrowUp' ? -1 : 1)
            }}
            onDragStart={() => draggable && setDragItem(n)}
            onDragOver={(e) => {
              if (!canDrop) return
              e.preventDefault()
              const rect = e.currentTarget.getBoundingClientRect()
              const pos: DropPos = e.clientY - rect.top < rect.height / 2 ? 'before' : 'after'
              if (!dragOver || dragOver.id !== n.id || dragOver.pos !== pos)
                setDragOver({ id: n.id, pos })
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (dragItem && canDrop)
                onMove(dragItem, n.id, dragOver?.id === n.id ? dragOver.pos : 'after')
              clearDrag()
            }}
            onDragEnd={clearDrag}
            className={[
              'flex h-9 items-center gap-2 rounded-md pr-2.5 text-s',
              draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
              on ? 'bg-ov-blue-50 font-semibold text-primary' : 'hover:bg-gray-100',
            ].join(' ')}
            style={{
              paddingLeft: TREE_PAD[n.depth],
              opacity: dragItem?.id === n.id ? 0.45 : 1,
              boxShadow:
                dragOver?.id === n.id && canDrop
                  ? dragOver.pos === 'before'
                    ? 'inset 0 2px 0 var(--color-primary)'
                    : 'inset 0 -2px 0 var(--color-primary)'
                  : undefined,
            }}
          >
            <NodeIcon kind={n.kind as NodeKind} active={on} />
            <span
              className={[
                'min-w-0 flex-1 truncate text-left',
                on
                  ? 'font-semibold text-primary'
                  : n.kind === 'cat'
                    ? 'font-semibold text-gray-800'
                    : n.paused
                      ? 'text-gray-400'
                      : 'text-gray-800',
              ].join(' ')}
            >
              {n.name}
            </span>
            {n.scoped && <ScopedIcon />}
            {n.paused && (
              <span className="inline-flex h-[18px] flex-none items-center rounded bg-l-gray px-1.5 text-2xs font-bold text-on-pastel">
                {t('admin-paused')}
              </span>
            )}
          </button>
        )
      })}
      <span className="mt-2 border-t border-gray-100 px-2.5 pt-2 text-xs leading-relaxed text-gray-400">
        {note}
      </span>
    </div>
  )
}
