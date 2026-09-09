import { useState } from 'react'

import { useTranslation } from 'react-i18next'

import type { DropPos, NodeKind, TreeNode } from './types'
import { NodeIcon } from './ui'
import { ScopedIcon } from '@/components/common/icons'
import { dndSame } from '@/utils/settingsTree'

/**
 * 좌측 트리 카드. 드래그는 **같은 형제 그룹 안에서만** 허용한다(`dndSame`) —
 * Go `PUT category-tree` 도 position 만 바꾸고 부모 이동을 하지 않는다.
 * 드롭 위치는 행 중앙을 기준으로 before/after 를 판정하고 `inset` 그림자로 표시한다.
 */
export function ContentTree({
  nodes,
  sel,
  onSelect,
  onReorder,
  note,
}: {
  nodes: TreeNode[]
  sel: { kind: NodeKind; id: string }
  onSelect: (next: { kind: NodeKind; id: string }) => void
  onReorder: (node: TreeNode, targetId: string, pos: DropPos) => void
  note: string
}) {
  const { t } = useTranslation()
  const [dragItem, setDragItem] = useState<TreeNode | null>(null)
  const [dragOver, setDragOver] = useState<{ id: string; pos: DropPos } | null>(null)

  const clearDrag = () => {
    setDragItem(null)
    setDragOver(null)
  }

  return (
    <div className="flex flex-col gap-px rounded-lg border border-gray-200 bg-card p-2">
      {nodes.map((n) => {
        const on = sel.kind === n.kind && sel.id === n.id
        const canDrop = dndSame(dragItem, n)
        return (
          <button
            key={`${n.kind}-${n.id}`}
            type="button"
            draggable
            onClick={() => onSelect({ kind: n.kind, id: n.id })}
            onDragStart={() => setDragItem(n)}
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
              if (dragItem && canDrop) {
                onReorder(dragItem, n.id, dragOver?.id === n.id ? dragOver.pos : 'after')
              }
              clearDrag()
            }}
            onDragEnd={clearDrag}
            className={[
              'flex h-9 cursor-grab items-center gap-2 rounded-md pr-2.5 text-s active:cursor-grabbing',
              on ? 'bg-ov-blue-50 font-semibold text-primary' : 'hover:bg-gray-100',
            ].join(' ')}
            style={{
              paddingLeft: n.pad,
              opacity: dragItem?.id === n.id ? 0.45 : 1,
              boxShadow:
                dragOver?.id === n.id && canDrop
                  ? dragOver.pos === 'before'
                    ? 'inset 0 2px 0 var(--color-primary)'
                    : 'inset 0 -2px 0 var(--color-primary)'
                  : undefined,
            }}
          >
            <NodeIcon kind={n.kind} active={on} />
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
