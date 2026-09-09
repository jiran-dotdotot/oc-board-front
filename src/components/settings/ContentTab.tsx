import { useId, useState } from 'react'

import { useTranslation } from 'react-i18next'

import { AddNodeModal } from './AddNodeModal'
import { ContentTree } from './ContentTree'
import { NodeDetailPanel } from './NodeDetailPanel'
import { TYPE_KEY, emptyDraft } from './constants'
import type { AddDraft, DropPos, NodeDraft, NodeKind, SettingsNode } from './types'
import { Modal } from '@/components/common/Modal'
import { fmtSize } from '@/components/drive/driveData'
import { useMe } from '@/hooks/useMe'
import {
  useBoardDetail,
  useCategoryDetail,
  useSettingsTree,
  useSettingsTreeMutations,
} from '@/hooks/useSettingsTree'
import type { BoardCreatePayload } from '@/types/board'
import type { CategoryUpdatePayload } from '@/types/category'
import {
  boardUpdatePatch,
  categoryUpdatePatch,
  draftOf,
  isEmptyPatch,
} from '@/utils/settingsPayload'
import {
  dndSame,
  flattenSettingsTree,
  labelToBytes,
  positionPatch,
  reorder,
} from '@/utils/settingsTree'

/**
 * 「게시판 관리」 탭 — 좌측 트리 + 우측 상세 패널 + 추가 모달.
 * 트리는 `GET {S}/categories/admin|management`, 쓰기는 게시판·카테고리 CRUD 와
 * `PUT {S}/category-tree`(순서) 다 — 전부 board 토큰으로 호출된다.
 */
export function ContentTab({
  addKind,
  onAddClose,
  onToast,
}: {
  addKind: NodeKind | null
  onAddClose: () => void
  onToast: (msg: string, tone?: 'success' | 'error') => void
}) {
  const { t } = useTranslation()
  const { data: me } = useMe()
  const isOfficeAdmin = !!me?.is_admin

  const { data: tree, isError, isLoading } = useSettingsTree()
  const m = useSettingsTreeMutations()

  const nodes = flattenSettingsTree(tree, { isOfficeAdmin }, t('nav-public'))
  const [selId, setSelId] = useState<string | null>(null)
  const node = nodes.find((n) => n.id === selId) ?? nodes[0]

  const [draft, setDraft] = useState<AddDraft>(() => emptyDraft(''))
  const [pendingDelete, setPendingDelete] = useState<SettingsNode | null>(null)
  const [liveMsg, setLiveMsg] = useState('')
  const delTitleId = useId()

  const isCategory = node?.kind === 'cat' || node?.kind === 'folder'
  // 트리에는 grant 가 없다 → 선택한 노드만 상세를 따로 받는다.
  const boardDetail = useBoardDetail(node && !isCategory && !node.fixed ? node.id : null)
  const catDetail = useCategoryDetail(isCategory && !node?.fixed ? node.id : null)
  const detail = isCategory ? catDetail.data : boardDetail.data

  /* ── 순서 변경 ──
     드래그·키보드 모두 여기로 모인다. 낙관적 갱신은 하지 않는다 — 3단 트리의 형제 배열을
     로컬에서 재배치했다가 서버와 맞추는 화해 로직이 오히려 버그 밭이고, 무효화 후 재조회
     한 번이면 끝난다. 대신 실패는 토스트로, 성공은 live region 으로 알린다. */
  const onMove = (dragged: SettingsNode, targetId: string, pos: DropPos) => {
    const siblings = nodes.filter((n) => n.id === dragged.id || dndSame(dragged, n))
    const next = reorder(siblings, dragged.id, targetId, pos)
    const patch = positionPatch(next.map((n) => ({ id: n.id, position: n.position })))
    if (Object.keys(patch).length === 0) return
    const isCat = dragged.kind === 'cat' || dragged.kind === 'folder'
    m.reorder.mutate(
      isCat ? { update_category_position: patch } : { update_board_position: patch },
      {
        onSuccess: () => {
          const at = next.findIndex((n) => n.id === dragged.id) + 1
          setLiveMsg(t('admin-reorder-moved', { name: dragged.name, n: at }))
        },
        onError: () => onToast(t('admin-reorder-failed'), 'error'),
      },
    )
  }

  /* ── 저장 ── */
  const onSave = (d: NodeDraft) => {
    if (!node) return
    if (isCategory) {
      const patch: CategoryUpdatePayload = categoryUpdatePatch(
        { name: node.name, is_active: draftOf(node).is_active },
        { name: d.name, is_active: d.is_active },
      )
      if (isEmptyPatch(patch)) return onToast(t('admin-no-change'))
      m.updateCategory.mutate(
        { id: node.id, payload: patch },
        {
          onSuccess: () => onToast(t('admin-toast-saved')),
          onError: () => onToast(t('env-error'), 'error'),
        },
      )
      return
    }
    // 전체 용량을 현재 사용량 아래로 내리면 업로드된 파일이 한도를 넘은 상태가 된다.
    // Go 는 검증하지 않으므로 프론트에서 막는다(레거시와 같은 규칙).
    const usage = boardDetail.data?.total_usage_size ?? 0
    if (d.size_limit != null && d.size_limit > 0 && usage > d.size_limit) {
      onToast(t('admin-quota-below-usage', { used: fmtSize(usage) }), 'error')
      return
    }
    const patch = boardUpdatePatch(draftOf(node), d)
    if (isEmptyPatch(patch)) return onToast(t('admin-no-change'))
    m.updateBoard.mutate(
      { id: node.id, payload: patch },
      {
        onSuccess: () => onToast(t('admin-toast-saved')),
        onError: () => onToast(t('env-error'), 'error'),
      },
    )
  }

  /* ── grant 제거 (추가는 조직도 부재로 불가 — BR-012) ── */
  const onRemoveGrant = (kind: 'admin' | 'member' | 'department', id: number) => {
    if (!node) return
    if (isCategory) {
      const payload: CategoryUpdatePayload =
        kind === 'admin'
          ? { delete_category_admin_user_id: [id] }
          : kind === 'member'
            ? { delete_category_member_user_id: [id] }
            : { delete_category_department_id: [id] }
      m.updateCategory.mutate(
        { id: node.id, payload },
        { onError: () => onToast(t('env-error'), 'error') },
      )
      return
    }
    m.updateBoard.mutate(
      {
        id: node.id,
        payload:
          kind === 'admin'
            ? { delete_board_admin_user_id: [id] }
            : kind === 'member'
              ? { delete_board_member_user_id: [id] }
              : { delete_board_department_id: [id] },
      },
      { onError: () => onToast(t('env-error'), 'error') },
    )
  }

  /* ── 삭제 ── */
  const confirmDelete = () => {
    const target = pendingDelete
    if (!target) return
    setPendingDelete(null)
    const opts = {
      onSuccess: () => {
        setSelId(null)
        onToast(t('admin-toast-deleted', { name: target.name }))
      },
      onError: () => onToast(t('env-error'), 'error'),
    }
    if (target.kind === 'cat' || target.kind === 'folder') m.deleteCategory.mutate(target.id, opts)
    else m.deleteBoard.mutate(target.id, opts)
  }

  /* ── 추가 ── */
  const locOpts: { v: string; label: string }[] = []
  for (const n of nodes) {
    if (n.kind === 'cat' && !n.fixed) locOpts.push({ v: `cat:${n.id}`, label: n.name })
    // 폴더 추가는 카테고리만 부모가 될 수 있다(Go 2단 제한).
    if (n.kind === 'folder' && addKind !== 'folder')
      locOpts.push({
        v: `fol:${n.id}`,
        label: `${nodes.find((x) => x.id === n.parentCat)?.name ?? ''} / ${n.name}`,
      })
  }

  const addSubmit = (): boolean => {
    const name = draft.name.trim()
    if (!name || !addKind) return false
    const [locType, locId] = (draft.loc || locOpts[0]?.v || '').split(':')
    const done = {
      onSuccess: () => {
        onAddClose()
        setDraft(emptyDraft(''))
        onToast(t('admin-toast-added', { name, type: t(TYPE_KEY[addKind]) }))
      },
      onError: () => onToast(t('env-error'), 'error'),
    }
    if (addKind === 'cat') {
      m.createCategory.mutate({ name, is_active: true }, done)
      return true
    }
    if (addKind === 'folder') {
      m.createCategory.mutate({ name, parent_category_id: locId, is_active: true }, done)
      return true
    }
    // 게시판·자료실. `category_id: null` 은 공용이고 회사 관리자만 만들 수 있다.
    const payload: BoardCreatePayload = {
      type: addKind === 'drive' ? 'DRIVE' : draft.btype,
      title: name,
      category_id: locType === 'cat' || locType === 'fol' ? locId : null,
      is_post_alarm: draft.alarm,
      is_active: addKind === 'board' ? draft.active : true,
    }
    if (addKind === 'board' && draft.desc.trim()) payload.description = draft.desc.trim()
    if (addKind === 'drive') {
      payload.size_limit = labelToBytes(draft.totalMax)
      payload.size_limit_per_file = labelToBytes(draft.fileMax)
      payload.except_extension = draft.ext
        .split(',')
        .map((x) => x.trim().replace(/^\./, ''))
        .filter(Boolean)
    }
    m.createBoard.mutate(payload, done)
    return true
  }

  const saving =
    m.updateBoard.isPending ||
    m.updateCategory.isPending ||
    m.deleteBoard.isPending ||
    m.deleteCategory.isPending

  if (isError) return <div className="py-6 text-s text-gray-500">{t('admin-tree-error')}</div>
  if (isLoading) return <div className="py-6 text-s text-gray-500">{t('common-loading')}</div>

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 items-start gap-4 min-[820px]:grid-cols-[300px_minmax(0,1fr)]">
        <ContentTree
          nodes={nodes}
          selId={node?.id ?? null}
          onSelect={(n) => setSelId(n.id)}
          onMove={onMove}
          note={t('admin-tree-note')}
          emptyText={t('admin-tree-empty')}
        />
        {node && (
          <NodeDetailPanel
            node={node}
            detail={detail}
            meName={me?.name ?? ''}
            saving={saving}
            onSave={onSave}
            onDelete={() => setPendingDelete(node)}
            onRemoveGrant={onRemoveGrant}
          />
        )}
      </div>
      <span className="text-xs text-gray-400">{t('admin-hint')}</span>
      {/* 순서 변경은 색(드롭선)으로만 전달되므로 결과를 문장으로도 알린다. */}
      <span aria-live="polite" className="sr-only">
        {liveMsg}
      </span>

      {addKind && (
        <AddNodeModal
          kind={addKind}
          draft={draft}
          locOpts={locOpts}
          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          onClose={onAddClose}
          onSubmit={addSubmit}
        />
      )}

      {pendingDelete && (
        <Modal onClose={() => setPendingDelete(null)} role="alertdialog" labelledBy={delTitleId}>
          <div className="w-[380px] max-w-full rounded-xl bg-card p-5 shadow-[var(--shadow-modal)]">
            <span id={delTitleId} className="block text-base font-bold">
              {t('admin-del-title', { name: pendingDelete.name })}
            </span>
            {/* 삭제 영향 범위를 반드시 알린다 — Go 에 복원 경로가 없다. */}
            <span className="mt-2 block text-s leading-relaxed text-gray-500">
              {pendingDelete.kind === 'cat' || pendingDelete.kind === 'folder'
                ? t('admin-del-cat-scope')
                : t('admin-del-board-scope')}
            </span>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="inline-flex h-10 items-center rounded-md border border-gray-200 bg-card px-4 text-sm font-semibold text-gray-800 hover:bg-gray-100"
              >
                {t('common-cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="inline-flex h-10 items-center rounded-md bg-destructive px-4 text-sm font-semibold text-white hover:bg-destructive-hover"
              >
                {t('common-delete')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
