// 조직도 피커의 순수 로직. 컴포넌트는 이 결과를 그리기만 한다(단위 테스트 대상).
import type { DepartmentMember, DepartmentNode, OrgSelection } from '@/types/department'

/** 피커 모드. `scope` 는 부서 grant 를 그대로 쓰고, `admin` 은 사용자만 보낼 수 있다. */
export type OrgMode = 'scope' | 'admin'

export interface OrgRow {
  key: string
  kind: 'dept' | 'user'
  id: number
  name: string
  /** 검색 모드의 사람 행에만 붙는 소속 표시. */
  sub?: string
  /** 들여쓰기 단계. 사람 행은 소속 부서보다 한 단계 깊다(정본). */
  depth: number
  /** 부서 인원수(자신+하위). 사람 행에는 없다. */
  count?: number
  hasKids: boolean
  expanded: boolean
  on: boolean
  mixed: boolean
  /** 상위 부서가 이미 지정돼 개별로 끌 수 없는 행. */
  locked: boolean
}

const setsOf = (sel: OrgSelection) => ({
  depts: new Set(sel.departmentIds),
  users: new Set(sel.userIds),
})

/** 자신+하위의 사용자 id. 겸직으로 중복 등장하므로 dedupe 한다. */
export function userIdsOf(node: DepartmentNode): number[] {
  return [...new Set(node.total_members.map((m) => m.user_id))]
}

function subtreeSelected(node: DepartmentNode, depts: Set<number>, users: Set<number>): boolean {
  if (depts.has(node.id)) return true
  if (node.members.some((m) => users.has(m.user_id))) return true
  return node.departments.some((d) => subtreeSelected(d, depts, users))
}

/** 한 부서 행의 체크 상태. `admin` 모드에는 부서 grant 가 없어 구성원 전원 여부로 판정한다. */
export function deptState(
  node: DepartmentNode,
  sel: OrgSelection,
  mode: OrgMode,
): { on: boolean; mixed: boolean } {
  const { depts, users } = setsOf(sel)
  if (mode === 'admin') {
    const ids = userIdsOf(node)
    const picked = ids.filter((id) => users.has(id)).length
    return { on: ids.length > 0 && picked === ids.length, mixed: picked > 0 && picked < ids.length }
  }
  if (depts.has(node.id)) return { on: true, mixed: false }
  return { on: false, mixed: subtreeSelected(node, depts, users) }
}

const memberName = (m: DepartmentMember) => m.user?.name ?? `#${m.user_id}`

/**
 * 트리를 화면 행 배열로 편다.
 * 검색어가 있으면 **평탄화**해서 이름이 맞는 부서·구성원만 한 단계로 늘어놓는다(정본).
 */
export function flattenOrg(
  root: DepartmentNode | null | undefined,
  opts: { expanded: Set<number>; query?: string; mode: OrgMode; selection: OrgSelection },
): OrgRow[] {
  if (!root) return []
  const { expanded, mode, selection } = opts
  const q = (opts.query ?? '').trim().toLowerCase()
  const { depts, users } = setsOf(selection)
  const rows: OrgRow[] = []

  if (q) {
    const walk = (node: DepartmentNode) => {
      if (node.name.toLowerCase().includes(q)) {
        const { on, mixed } = deptState(node, selection, mode)
        rows.push({
          key: `d:${node.id}`,
          kind: 'dept',
          id: node.id,
          name: node.name,
          depth: 0,
          count: node.member_count,
          hasKids: false,
          expanded: false,
          on,
          mixed,
          locked: false,
        })
      }
      for (const m of node.members) {
        if (!memberName(m).toLowerCase().includes(q)) continue
        rows.push({
          key: `u:${node.id}:${m.user_id}`,
          kind: 'user',
          id: m.user_id,
          name: memberName(m),
          sub: node.name,
          depth: 0,
          hasKids: false,
          expanded: false,
          on: users.has(m.user_id),
          mixed: false,
          locked: mode === 'scope' && depts.has(node.id),
        })
      }
      node.departments.forEach(walk)
    }
    walk(root)
    return rows
  }

  const walk = (node: DepartmentNode, depth: number, lockedByAncestor: boolean) => {
    const { on, mixed } = deptState(node, selection, mode)
    const hasKids = node.departments.length > 0 || node.members.length > 0
    const open = expanded.has(node.id)
    rows.push({
      key: `d:${node.id}`,
      kind: 'dept',
      id: node.id,
      name: node.name,
      depth,
      count: node.member_count,
      hasKids,
      expanded: open,
      on: on || lockedByAncestor,
      mixed: lockedByAncestor ? false : mixed,
      locked: lockedByAncestor,
    })
    if (!open) return
    const locksChildren = lockedByAncestor || (mode === 'scope' && depts.has(node.id))
    for (const child of node.departments) walk(child, depth + 1, locksChildren)
    for (const m of node.members) {
      rows.push({
        key: `u:${node.id}:${m.user_id}`,
        kind: 'user',
        id: m.user_id,
        name: memberName(m),
        depth: depth + 1,
        hasKids: false,
        expanded: false,
        on: users.has(m.user_id) || locksChildren,
        mixed: false,
        locked: locksChildren,
      })
    }
  }
  walk(root, 0, false)
  return rows
}

function findDept(node: DepartmentNode, id: number): DepartmentNode | null {
  if (node.id === id) return node
  for (const child of node.departments) {
    const hit = findDept(child, id)
    if (hit) return hit
  }
  return null
}

const without = (list: number[], drop: Set<number>) => list.filter((id) => !drop.has(id))

/**
 * 행 하나를 토글한 새 선택 상태.
 * - `scope`: 부서는 **부서 grant 하나**로 담는다(구성원으로 펼치지 않는다 — 인사이동이 자동 반영된다).
 *   부서를 켜면 그 아래에서 개별로 골라 둔 사람·부서는 의미가 없어지므로 걷어낸다.
 * - `admin`: 부서 grant 가 없으므로 소속 구성원 전체를 사용자 id 로 편다(정본 힌트와 같다).
 */
export function toggleRow(
  root: DepartmentNode,
  row: Pick<OrgRow, 'kind' | 'id'>,
  sel: OrgSelection,
  mode: OrgMode,
): OrgSelection {
  const { depts, users } = setsOf(sel)
  if (row.kind === 'user') {
    return {
      ...sel,
      userIds: users.has(row.id)
        ? sel.userIds.filter((id) => id !== row.id)
        : [...sel.userIds, row.id],
    }
  }
  const node = findDept(root, row.id)
  if (!node) return sel
  const memberIds = new Set(userIdsOf(node))

  if (mode === 'admin') {
    const on = memberIds.size > 0 && [...memberIds].every((id) => users.has(id))
    return {
      departmentIds: sel.departmentIds,
      userIds: on ? without(sel.userIds, memberIds) : [...new Set([...sel.userIds, ...memberIds])],
    }
  }

  if (depts.has(row.id)) {
    return { ...sel, departmentIds: sel.departmentIds.filter((id) => id !== row.id) }
  }
  const descendantDepts = new Set<number>()
  const collect = (n: DepartmentNode) => {
    for (const c of n.departments) {
      descendantDepts.add(c.id)
      collect(c)
    }
  }
  collect(node)
  return {
    departmentIds: [...without(sel.departmentIds, descendantDepts), row.id],
    userIds: without(sel.userIds, memberIds),
  }
}

export interface OrgUser {
  id: number
  name: string
  team: string
}

/** 조직도 전체의 사용자 목록(겸직 dedupe). 추가 모달의 관리자 이름 검색이 쓴다. */
export function allUsersOf(root: DepartmentNode | null | undefined): OrgUser[] {
  if (!root) return []
  const out: OrgUser[] = []
  const seen = new Set<number>()
  const walk = (node: DepartmentNode) => {
    for (const m of node.members) {
      if (seen.has(m.user_id)) continue
      seen.add(m.user_id)
      out.push({ id: m.user_id, name: memberName(m), team: node.name })
    }
    node.departments.forEach(walk)
  }
  walk(root)
  return out
}

export interface OrgChip {
  key: string
  kind: 'dept' | 'user'
  id: number
  name: string
  sub: string
  count: number
}

/** 선택 목록(우측 270px 패널). 부서가 먼저, 그다음 개인이다. */
export function chipsOf(
  root: DepartmentNode | null | undefined,
  sel: OrgSelection,
  labels: { all: string } = { all: '전체' },
): OrgChip[] {
  if (!root) return []
  const chips: OrgChip[] = []
  const walk = (node: DepartmentNode, parent: DepartmentNode | null) => {
    if (sel.departmentIds.includes(node.id)) {
      chips.push({
        key: `d:${node.id}`,
        kind: 'dept',
        id: node.id,
        name: node.name,
        sub: parent ? parent.name : labels.all,
        count: node.member_count,
      })
    }
    node.departments.forEach((c) => walk(c, node))
  }
  walk(root, null)

  const seen = new Set<number>()
  const walkUsers = (node: DepartmentNode) => {
    for (const m of node.members) {
      if (!sel.userIds.includes(m.user_id) || seen.has(m.user_id)) continue
      seen.add(m.user_id)
      chips.push({
        key: `u:${m.user_id}`,
        kind: 'user',
        id: m.user_id,
        name: memberName(m),
        sub: node.name,
        count: 1,
      })
    }
    node.departments.forEach(walkUsers)
  }
  walkUsers(root)
  return chips
}

/**
 * 정본 푸터의 `총 N명`. 부서 인원수를 단순 합산하면 **상위·하위 부서가 겹칠 때 실제 인원보다
 * 커진다**(실측: 전 부서가 지정된 게시판에서 496명이 577명으로 나왔다) → 실제로 덮이는
 * 사람을 dedupe 해서 센다.
 */
export function totalOf(root: DepartmentNode | null | undefined, sel: OrgSelection): number {
  if (!root) return 0
  const picked = new Set(sel.userIds)
  const depts = new Set(sel.departmentIds)
  const walk = (node: DepartmentNode) => {
    if (depts.has(node.id)) for (const id of userIdsOf(node)) picked.add(id)
    node.departments.forEach(walk)
  }
  walk(root)
  return picked.size
}

export interface OrgDiff {
  insertDepartmentIds: number[]
  deleteDepartmentIds: number[]
  insertUserIds: number[]
  deleteUserIds: number[]
}

/** 저장 시 보낼 추가·삭제. 서버는 같은 id 가 양쪽에 있으면 추가를 택한다 → 겹치지 않게 만든다. */
export function orgDiff(before: OrgSelection, after: OrgSelection): OrgDiff {
  const diff = (a: number[], b: number[]) => {
    const has = new Set(b)
    return a.filter((id) => !has.has(id))
  }
  return {
    insertDepartmentIds: diff(after.departmentIds, before.departmentIds),
    deleteDepartmentIds: diff(before.departmentIds, after.departmentIds),
    insertUserIds: diff(after.userIds, before.userIds),
    deleteUserIds: diff(before.userIds, after.userIds),
  }
}

export function isEmptyDiff(diff: OrgDiff): boolean {
  return (
    diff.insertDepartmentIds.length === 0 &&
    diff.deleteDepartmentIds.length === 0 &&
    diff.insertUserIds.length === 0 &&
    diff.deleteUserIds.length === 0
  )
}

export function isEmptySelection(sel: OrgSelection): boolean {
  return sel.departmentIds.length === 0 && sel.userIds.length === 0
}
