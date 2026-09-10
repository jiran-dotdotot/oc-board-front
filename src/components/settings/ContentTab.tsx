import { useId, useState } from 'react'

import { useTranslation } from 'react-i18next'

import { AddNodeModal } from './AddNodeModal'
import { ContentTree } from './ContentTree'
import { NodeDetailPanel } from './NodeDetailPanel'
import { TYPE_KEY, emptyDraft } from './constants'
import type { AddDraft, DropPos, NodeDraft, NodeKind, ScopeMode, SettingsNode } from './types'
import { Modal } from '@/components/common/Modal'
import { fmtSize } from '@/components/drive/driveData'
import { useMe } from '@/hooks/useMe'
import {
  useBoardDetail,
  useCategoryDetail,
  useSettingsTree,
  useSettingsTreeMutations,
} from '@/hooks/useSettingsTree'
import type { BoardCreatePayload, BoardUpdatePayload } from '@/types/board'
import type { CategoryUpdatePayload, IgnoredGrants } from '@/types/category'
import type { OrgSelection } from '@/types/department'
import { orgDiff } from '@/utils/orgTree'
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
  const scopeTitleId = useId()

  const isCategory = node?.kind === 'cat' || node?.kind === 'folder'
  // 트리에는 grant 가 없다 → 선택한 노드만 상세를 따로 받는다.
  const boardDetail = useBoardDetail(node && !isCategory && !node.fixed ? node.id : null)
  const catDetail = useCategoryDetail(isCategory && !node?.fixed ? node.id : null)
  const detail = isCategory ? catDetail.data : boardDetail.data

  /* ── 공개 범위 ──
     서버 값: 게시판은 `read_permission`(ALL=전체 공개), 카테고리는 grant 유무가 전부다
     (카테고리에는 권한 등급이 없다 — 03-category.md). 「조직 지정」을 «고른» 직후에는
     아직 보낼 것이 없으므로(대상 미선택) 로컬 오버라이드로만 피커를 연다. */
  const grantCount =
    detail && 'board_departments' in detail
      ? detail.board_departments.length + detail.board_members.length
      : detail && 'category_departments' in detail
        ? detail.category_departments.length + detail.category_members.length
        : 0
  const serverScope: ScopeMode = isCategory
    ? grantCount > 0
      ? 'org'
      : 'all'
    : node?.board?.read_permission && node.board.read_permission !== 'ALL'
      ? 'org'
      : 'all'
  const [scopeOverride, setScopeOverride] = useState<{ key: string; mode: ScopeMode } | null>(null)
  const nodeKey = node ? `${node.kind}:${node.id}` : ''
  const scopeMode = scopeOverride?.key === nodeKey ? scopeOverride.mode : serverScope
  const [pendingScopeClear, setPendingScopeClear] = useState<SettingsNode | null>(null)
  /** 조직도를 가지치기할 상위 카테고리. 카테고리 자신은 부모(없으면 전사)를 기준으로 본다. */
  const orgCategoryId = node
    ? isCategory
      ? (node.parentCat ?? null)
      : (node.board?.category_id ?? null)
    : null

  /** 조용히 무시된 대상이 있으면 성공으로 삼키지 않는다(계약상 정상 응답이다). */
  const warnIgnored = (res: IgnoredGrants) => {
    const n = (res?.ignored_user_ids?.length ?? 0) + (res?.ignored_department_ids?.length ?? 0)
    if (n > 0) onToast(t('admin-grant-ignored', { n }), 'error')
    return n
  }

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

  /* ── 공개 범위·관리자 ──
     이름·설정과 달리 저장 버튼을 거치지 않고 고른 즉시 반영한다(기존 제거 동작과 같은 규칙).
     보낸 키만 바뀌므로 diff 한 것만 싣는다. */
  const applyGrants = (
    payload: BoardUpdatePayload & CategoryUpdatePayload,
    onDone?: () => void,
  ) => {
    if (!node) return
    const opts = {
      onSuccess: (res: IgnoredGrants) => {
        if (warnIgnored(res) === 0) onToast(t('admin-toast-saved'))
        onDone?.()
      },
      onError: () => onToast(t('env-save-error'), 'error'),
    }
    if (isCategory) m.updateCategory.mutate({ id: node.id, payload }, opts)
    else m.updateBoard.mutate({ id: node.id, payload }, opts)
  }

  const currentSelection = (): OrgSelection => ({
    departmentIds:
      detail && 'board_departments' in detail
        ? detail.board_departments.map((g) => g.department_id)
        : detail && 'category_departments' in detail
          ? detail.category_departments.map((g) => g.department_id)
          : [],
    userIds:
      detail && 'board_members' in detail
        ? detail.board_members.map((g) => g.user_id)
        : detail && 'category_members' in detail
          ? detail.category_members.map((g) => g.user_id)
          : [],
  })

  const onScopeSelection = (next: OrgSelection) => {
    const d = orgDiff(currentSelection(), next)
    const payload: BoardUpdatePayload & CategoryUpdatePayload = {}
    if (isCategory) {
      if (d.insertDepartmentIds.length)
        payload.insert_category_department_id = d.insertDepartmentIds
      if (d.deleteDepartmentIds.length)
        payload.delete_category_department_id = d.deleteDepartmentIds
      if (d.insertUserIds.length) payload.insert_category_member_user_id = d.insertUserIds
      if (d.deleteUserIds.length) payload.delete_category_member_user_id = d.deleteUserIds
    } else {
      if (d.insertDepartmentIds.length) payload.insert_board_department_id = d.insertDepartmentIds
      if (d.deleteDepartmentIds.length) payload.delete_board_department_id = d.deleteDepartmentIds
      if (d.insertUserIds.length) payload.insert_board_member_user_id = d.insertUserIds
      if (d.deleteUserIds.length) payload.delete_board_member_user_id = d.deleteUserIds
      // 게시판은 등급도 함께 옮긴다 — grant 만 넣고 ALL 로 두면 카테고리 멤버 전원이 읽는다.
      if (node?.board?.read_permission !== 'MEMBER') payload.read_permission = 'MEMBER'
    }
    if (isEmptyPatch(payload)) return onToast(t('admin-no-change'))
    applyGrants(payload)
  }

  const onAdmins = (next: number[]) => {
    const before = (
      detail && 'board_admins' in detail
        ? detail.board_admins
        : detail && 'category_admins' in detail
          ? detail.category_admins
          : []
    ).map((g) => g.user_id)
    const d = orgDiff({ departmentIds: [], userIds: before }, { departmentIds: [], userIds: next })
    const payload: BoardUpdatePayload & CategoryUpdatePayload = {}
    if (isCategory) {
      if (d.insertUserIds.length) payload.insert_category_admin_user_id = d.insertUserIds
      if (d.deleteUserIds.length) payload.delete_category_admin_user_id = d.deleteUserIds
    } else {
      if (d.insertUserIds.length) payload.insert_board_admin_user_id = d.insertUserIds
      if (d.deleteUserIds.length) payload.delete_board_admin_user_id = d.deleteUserIds
    }
    if (isEmptyPatch(payload)) return onToast(t('admin-no-change'))
    applyGrants(payload)
  }

  /**
   * 라디오 전환.
   * - 조직 지정 → 대상은 피커에서 고른다(여기서는 아무것도 보내지 않는다)
   * - 전체 공개 → 게시판은 `read_permission`만 ALL 로(기존 grant 유지: ALL 판정은 상위 카테고리
   *   범위 안이라 넓어지지 않는다). **카테고리는 등급이 없어 grant 를 지우는 수밖에 없고,
   *   그 삭제가 직속 자식·게시판까지 전파되므로 확인을 받는다**(03-category.md:130).
   */
  const onScopeMode = (next: ScopeMode) => {
    if (!node) return
    setScopeOverride({ key: nodeKey, mode: next })
    if (next === 'org') return
    if (!isCategory) {
      if (node.board?.read_permission === 'ALL') return
      applyGrants({ read_permission: 'ALL' })
      return
    }
    if (grantCount === 0) return
    setPendingScopeClear(node)
  }

  const confirmScopeClear = () => {
    const sel = currentSelection()
    setPendingScopeClear(null)
    const payload: CategoryUpdatePayload = {}
    if (sel.departmentIds.length) payload.delete_category_department_id = sel.departmentIds
    if (sel.userIds.length) payload.delete_category_member_user_id = sel.userIds
    if (isEmptyPatch(payload)) return
    applyGrants(payload)
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
      onSuccess: (res: IgnoredGrants) => {
        onAddClose()
        setDraft(emptyDraft(''))
        if (warnIgnored(res) === 0)
          onToast(t('admin-toast-added', { name, type: t(TYPE_KEY[addKind]) }))
      },
      onError: () => onToast(t('env-error'), 'error'),
    }
    const org = draft.scope === 'org' ? draft.org : { departmentIds: [], userIds: [] }
    const admins = draft.scope === 'org' ? draft.admins : []
    if (addKind === 'cat' || addKind === 'folder') {
      m.createCategory.mutate(
        {
          name,
          is_active: true,
          ...(addKind === 'folder' ? { parent_category_id: locId } : {}),
          ...(org.departmentIds.length ? { insert_category_department_id: org.departmentIds } : {}),
          ...(org.userIds.length ? { insert_category_member_user_id: org.userIds } : {}),
          ...(admins.length ? { insert_category_admin_user_id: admins } : {}),
        },
        done,
      )
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
    // 공용(카테고리 없음)에서는 서버가 grant 를 무시한다 — 보내지 않는다.
    if (payload.category_id && draft.scope === 'org') {
      payload.read_permission = 'MEMBER'
      if (org.departmentIds.length) payload.insert_board_department_id = org.departmentIds
      if (org.userIds.length) payload.insert_board_member_user_id = org.userIds
      if (admins.length) payload.insert_board_admin_user_id = admins
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
            scopeMode={scopeMode}
            orgCategoryId={orgCategoryId}
            onSave={onSave}
            onDelete={() => setPendingDelete(node)}
            onScopeMode={onScopeMode}
            onScopeSelection={onScopeSelection}
            onAdmins={onAdmins}
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
          orgCategoryId={
            addKind === 'cat' ? null : ((draft.loc || locOpts[0]?.v || '').split(':')[1] ?? null)
          }
          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          onClose={onAddClose}
          onSubmit={addSubmit}
        />
      )}

      {pendingScopeClear && (
        <Modal
          onClose={() => setPendingScopeClear(null)}
          role="alertdialog"
          labelledBy={scopeTitleId}
        >
          <div className="w-[380px] max-w-full rounded-xl bg-card p-5 shadow-[var(--shadow-modal)]">
            <span id={scopeTitleId} className="block text-base font-bold">
              {t('admin-scope-clear-title', { name: pendingScopeClear.name })}
            </span>
            {/* 카테고리 grant 삭제는 직속 자식과 그 게시판까지 전파된다 — 반드시 알린다. */}
            <span className="mt-2 block text-s leading-relaxed text-gray-500">
              {t('admin-scope-clear-desc', { n: grantCount })}
            </span>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingScopeClear(null)
                  setScopeOverride({ key: nodeKey, mode: 'org' })
                }}
                className="inline-flex h-10 items-center rounded-md border border-gray-200 bg-card px-4 text-sm font-semibold text-gray-800 hover:bg-gray-100"
              >
                {t('common-cancel')}
              </button>
              <button
                type="button"
                onClick={confirmScopeClear}
                className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-ov-blue-700"
              >
                {t('common-confirm')}
              </button>
            </div>
          </div>
        </Modal>
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
