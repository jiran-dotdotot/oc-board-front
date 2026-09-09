import { useState } from 'react'

import { useTranslation } from 'react-i18next'

import { AddNodeModal } from './AddNodeModal'
import { ContentTree } from './ContentTree'
import { NodeDetailPanel } from './NodeDetailPanel'
import { TYPE_KEY, emptyDraft } from './constants'
import type { AddDraft, Cat, DropPos, Folder, Item, NodeKind, TreeNode } from './types'
import {
  OrgPickerModal,
  type PickerMode,
  type PickerResult,
} from '@/components/settings/OrgPickerModal'
import { INITIAL_CATS, INITIAL_FOLDERS, INITIAL_ITEMS } from '@/components/settings/treeData'
import { useMe } from '@/hooks/useMe'
import { flattenTree, reorder } from '@/utils/settingsTree'

const DEFAULT_CAT = 'shared'

/**
 * 「게시판 관리」 탭 — 좌측 트리 + 우측 상세 패널 + 추가 모달.
 * ⚠️ 트리는 아직 `treeData.ts` 데모 데이터이고 저장·삭제·정렬이 토스트에서 끝난다.
 * Go 배선(카테고리·게시판 CRUD, `PUT category-tree`)은 다음 단계에서 이 파일에 들어온다.
 */
export function ContentTab({
  addKind,
  onAddClose,
  onToast,
}: {
  /** 헤더 「추가」 메뉴가 고른 종류. null 이면 모달을 닫는다. */
  addKind: NodeKind | null
  onAddClose: () => void
  onToast: (msg: string) => void
}) {
  const { t } = useTranslation()
  const { data: me } = useMe()

  const [cats, setCats] = useState<Cat[]>(INITIAL_CATS)
  const [folders, setFolders] = useState<Folder[]>(INITIAL_FOLDERS)
  const [items, setItems] = useState<Item[]>(INITIAL_ITEMS)
  const [sel, setSel] = useState<{ kind: NodeKind; id: string }>({ kind: 'cat', id: DEFAULT_CAT })
  const [picker, setPicker] = useState<{ mode: PickerMode; target: 'sel' | 'add' } | null>(null)
  const [draft, setDraft] = useState<AddDraft>(() => emptyDraft(`cat:${DEFAULT_CAT}`))

  // 선택 노드 — 없어졌으면 첫 카테고리로 되돌린다.
  const found: Cat | Folder | Item | undefined =
    sel.kind === 'cat'
      ? cats.find((c) => c.id === sel.id)
      : sel.kind === 'folder'
        ? folders.find((f) => f.id === sel.id)
        : items.find((b) => b.id === sel.id)
  const node = found ?? cats[0]
  const kind: NodeKind = found ? sel.kind : 'cat'
  const item = kind === 'board' || kind === 'drive' ? (node as Item) : null

  const patchSel = (patch: Partial<Cat & Folder & Item>) => {
    if (kind === 'cat')
      setCats((prev) => prev.map((c) => (c.id === node.id ? { ...c, ...patch } : c)))
    else if (kind === 'folder')
      setFolders((prev) => prev.map((f) => (f.id === node.id ? { ...f, ...patch } : f)))
    else setItems((prev) => prev.map((b) => (b.id === node.id ? { ...b, ...patch } : b)))
  }

  const tree = flattenTree(cats, folders, items)

  const onReorder = (dragged: TreeNode, targetId: string, pos: DropPos) => {
    if (dragged.kind === 'cat') setCats((prev) => reorder(prev, dragged.id, targetId, pos))
    else if (dragged.kind === 'folder')
      setFolders((prev) => reorder(prev, dragged.id, targetId, pos))
    else setItems((prev) => reorder(prev, dragged.id, targetId, pos))
  }

  // 추가 모달의 위치 선택지 — 폴더 추가는 카테고리만 고를 수 있다.
  const locOpts: { v: string; label: string }[] = []
  for (const c of cats) {
    locOpts.push({ v: `cat:${c.id}`, label: c.name })
    if (addKind !== 'folder')
      for (const f of folders.filter((x) => x.cat === c.id))
        locOpts.push({ v: `fol:${f.id}`, label: `${c.name} / ${f.name}` })
  }

  const addSubmit = (): boolean => {
    const name = draft.name.trim()
    if (!name || !addKind) return false
    const id = `n${Date.now()}`
    const [locType, locId] = (draft.loc || `cat:${DEFAULT_CAT}`).split(':')
    if (addKind === 'cat') {
      setCats((prev) => [
        ...prev,
        {
          id,
          name,
          scope: draft.scope,
          scopeLabel: draft.scopeLabel || undefined,
          admins: draft.admins,
        },
      ])
      setSel({ kind: 'cat', id })
    } else if (addKind === 'folder') {
      setFolders((prev) => [
        ...prev,
        {
          id,
          name,
          cat: locId,
          scope: draft.scope,
          scopeLabel: draft.scopeLabel || undefined,
          admins: draft.admins,
        },
      ])
      setSel({ kind: 'folder', id })
    } else {
      const cat =
        locType === 'cat' ? locId : (folders.find((f) => f.id === locId)?.cat ?? DEFAULT_CAT)
      const base: Item = {
        id,
        name,
        type: addKind,
        active: addKind === 'board' ? draft.active : true,
        scope: draft.scope,
        scopeLabel: draft.scopeLabel || undefined,
        admins: draft.admins,
        alarm: draft.alarm,
        cat,
        folder: locType === 'fol' ? locId : null,
      }
      if (addKind === 'board') {
        base.btype = draft.btype
        base.desc = draft.desc.trim() || undefined
      } else {
        base.fileMax = draft.fileMax
        base.totalMax = draft.totalMax
        base.exts = draft.ext
          .split(',')
          .map((x) => x.trim().replace(/^\./, '').toLowerCase())
          .filter(Boolean)
      }
      setItems((prev) => [...prev, base])
      setSel({ kind: addKind, id })
    }
    onAddClose()
    onToast(t('admin-toast-added', { name, type: t(TYPE_KEY[addKind]) }))
    return true
  }

  const onPickerConfirm = (r: PickerResult) => {
    if (!picker) return
    if (picker.mode === 'scope') {
      if (picker.target === 'sel') patchSel({ scope: 'org', scopeLabel: r.label })
      else setDraft((d) => ({ ...d, scope: 'org', scopeLabel: r.label }))
      onToast(t('admin-toast-scope-set'))
    } else {
      const merge = (cur: string[]) => {
        const out = cur.slice()
        for (const n of r.names) if (!out.includes(n)) out.push(n)
        return out
      }
      if (picker.target === 'sel') patchSel({ admins: merge(currentAdmins(node)) })
      else setDraft((d) => ({ ...d, admins: merge(d.admins) }))
      onToast(t('admin-toast-manager-set', { n: r.names.length }))
    }
    setPicker(null)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 items-start gap-4 min-[820px]:grid-cols-[300px_minmax(0,1fr)]">
        <ContentTree
          nodes={tree}
          sel={sel}
          onSelect={setSel}
          onReorder={onReorder}
          note={t('admin-tree-note')}
        />
        <NodeDetailPanel
          node={node}
          kind={kind}
          item={item}
          admins={currentAdmins(node)}
          meName={me?.name ?? ''}
          onPatch={patchSel}
          onOpenScopePicker={() => setPicker({ mode: 'scope', target: 'sel' })}
          onOpenAdminPicker={() => setPicker({ mode: 'admin', target: 'sel' })}
          onDelete={() => onToast(t('admin-toast-del-demo', { name: node.name }))}
          onSave={() => onToast(t('admin-toast-saved'))}
        />
      </div>
      <span className="text-xs text-gray-400">{t('admin-hint')}</span>

      {addKind && (
        <AddNodeModal
          kind={addKind}
          draft={draft}
          locOpts={locOpts}
          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          onOpenScopePicker={() => setPicker({ mode: 'scope', target: 'add' })}
          onOpenAdminPicker={() => setPicker({ mode: 'admin', target: 'add' })}
          onClose={onAddClose}
          onSubmit={addSubmit}
        />
      )}

      {/* 조직도 피커 — 열릴 때마다 새로 마운트되어 선택 state 가 초기화된다. */}
      {picker && (
        <OrgPickerModal
          open
          mode={picker.mode}
          onClose={() => setPicker(null)}
          onConfirm={onPickerConfirm}
        />
      )}
    </div>
  )
}

function currentAdmins(node: Cat | Folder | Item): string[] {
  return node.admins ?? []
}
