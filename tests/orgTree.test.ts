import type { DepartmentMember, DepartmentNode } from '@/types/department'
import {
  chipsOf,
  deptState,
  flattenOrg,
  isEmptyDiff,
  orgDiff,
  toggleRow,
  totalOf,
  userIdsOf,
} from '@/utils/orgTree'
import { describe, expect, it } from 'vitest'

/* 조직도 픽스처 — 실서버 모양(루트 1개, members=직속, total_members=자신+하위 dedupe). */
const member = (userId: number, deptId: number, name: string): DepartmentMember => ({
  id: userId * 10,
  company_id: 1,
  department_id: deptId,
  user_id: userId,
  rank_id: null,
  role_id: null,
  position: 0,
  leader: false,
  user: {
    id: userId,
    name,
    profile_image_id: null,
    disabled_at: null,
    deleted_at: null,
    profile_src: null,
  },
  rank: null,
  role: null,
  department: null,
})

const dev1 = member(11, 10, '김개발')
const dev2 = member(12, 10, '이개발')
const qa1 = member(13, 11, '박큐에이')
// 겸직 — 같은 사람이 두 부서의 members 에 등장한다.
const both = member(14, 10, '최겸직')
const bothInQa = member(14, 11, '최겸직')
const ceo = member(1, 1, '대표')

const org: DepartmentNode = {
  id: 1,
  parent_id: null,
  name: '테스트 회사',
  breadcrumbs: '{1}',
  member_count: 5,
  is_category_department: true,
  members: [ceo],
  total_members: [ceo, dev1, dev2, both, qa1],
  departments: [
    {
      id: 2,
      parent_id: 1,
      name: '개발본부',
      breadcrumbs: '{1,2}',
      member_count: 4,
      is_category_department: true,
      members: [],
      total_members: [dev1, dev2, both, qa1],
      departments: [
        {
          id: 10,
          parent_id: 2,
          name: '개발팀',
          breadcrumbs: '{1,2,10}',
          member_count: 3,
          is_category_department: true,
          members: [dev1, dev2, both],
          total_members: [dev1, dev2, both],
          departments: [],
        },
        {
          id: 11,
          parent_id: 2,
          name: 'QA팀',
          breadcrumbs: '{1,2,11}',
          member_count: 2,
          is_category_department: true,
          members: [qa1, bothInQa],
          total_members: [qa1, bothInQa],
          departments: [],
        },
      ],
    },
  ],
}

const all = new Set([1, 2, 10, 11])
const none = { departmentIds: [], userIds: [] }

describe('userIdsOf', () => {
  it('겸직 중복을 제거한다', () => {
    expect(userIdsOf(org.departments[0])).toEqual([11, 12, 14, 13])
    expect(userIdsOf(org.departments[0].departments[1])).toEqual([13, 14])
  })
})

describe('flattenOrg', () => {
  it('닫힌 트리는 루트 한 줄이고, 펼치면 하위 부서 다음에 직속 구성원이 온다', () => {
    expect(flattenOrg(org, { expanded: new Set(), mode: 'scope', selection: none })).toHaveLength(1)
    const rows = flattenOrg(org, { expanded: new Set([1]), mode: 'scope', selection: none })
    expect(rows.map((r) => r.key)).toEqual(['d:1', 'd:2', 'u:1:1'])
    expect(rows[1].depth).toBe(1)
    // 사람 행은 소속 부서보다 한 단계 깊다(정본 들여쓰기).
    expect(rows[2].depth).toBe(1)
  })

  it('부서 행에는 인원수가, 사람 행에는 없다', () => {
    const rows = flattenOrg(org, { expanded: new Set([1]), mode: 'scope', selection: none })
    expect(rows[0].count).toBe(5)
    expect(rows[2].count).toBeUndefined()
  })

  it('일부만 고르면 상위가 mixed 다', () => {
    const rows = flattenOrg(org, {
      expanded: all,
      mode: 'scope',
      selection: { departmentIds: [10], userIds: [] },
    })
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]))
    expect(byKey['d:10'].on).toBe(true)
    expect(byKey['d:2'].mixed).toBe(true)
    expect(byKey['d:2'].on).toBe(false)
    expect(byKey['d:1'].mixed).toBe(true)
  })

  it('상위 부서가 지정되면 하위는 켜진 채 잠긴다', () => {
    const rows = flattenOrg(org, {
      expanded: all,
      mode: 'scope',
      selection: { departmentIds: [2], userIds: [] },
    })
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]))
    expect(byKey['d:10']).toMatchObject({ on: true, locked: true, mixed: false })
    expect(byKey['u:10:11']).toMatchObject({ on: true, locked: true })
    // 형제(루트 직속)는 잠기지 않는다.
    expect(byKey['u:1:1']).toMatchObject({ on: false, locked: false })
  })

  it('검색은 평탄화하고 사람 행에 소속을 붙인다', () => {
    const rows = flattenOrg(org, {
      expanded: new Set(),
      query: '개발',
      mode: 'scope',
      selection: none,
    })
    expect(rows.map((r) => r.key)).toEqual(['d:2', 'd:10', 'u:10:11', 'u:10:12'])
    expect(rows.every((r) => r.depth === 0)).toBe(true)
    expect(rows[2]).toMatchObject({ name: '김개발', sub: '개발팀' })
  })
})

describe('deptState — admin 모드는 부서 grant 가 없어 구성원 전원 여부로 판정한다', () => {
  it('구성원이 전부 선택되면 on, 일부면 mixed', () => {
    const team = org.departments[0].departments[0]
    expect(deptState(team, { departmentIds: [], userIds: [11] }, 'admin')).toEqual({
      on: false,
      mixed: true,
    })
    expect(deptState(team, { departmentIds: [], userIds: [11, 12, 14] }, 'admin')).toEqual({
      on: true,
      mixed: false,
    })
  })

  it('scope 모드에서는 부서 id 하나로 on 이다', () => {
    const team = org.departments[0].departments[0]
    expect(deptState(team, { departmentIds: [10], userIds: [] }, 'scope')).toEqual({
      on: true,
      mixed: false,
    })
  })
})

describe('toggleRow', () => {
  it('scope: 부서는 grant 하나로 담고 그 아래 개별 선택은 걷어낸다', () => {
    const sel = { departmentIds: [10], userIds: [13] }
    const next = toggleRow(org, { kind: 'dept', id: 2 }, sel, 'scope')
    expect(next).toEqual({ departmentIds: [2], userIds: [] })
  })

  it('scope: 다시 누르면 그 부서만 빠진다', () => {
    const next = toggleRow(
      org,
      { kind: 'dept', id: 2 },
      { departmentIds: [2], userIds: [] },
      'scope',
    )
    expect(next).toEqual({ departmentIds: [], userIds: [] })
  })

  it('admin: 부서를 켜면 소속 구성원 전원이 사용자 id 로 들어간다(겸직 dedupe)', () => {
    const next = toggleRow(org, { kind: 'dept', id: 2 }, none, 'admin')
    expect(next.departmentIds).toEqual([])
    expect([...next.userIds].sort((a, b) => a - b)).toEqual([11, 12, 13, 14])
    const off = toggleRow(org, { kind: 'dept', id: 2 }, next, 'admin')
    expect(off.userIds).toEqual([])
  })

  it('사람 행은 사용자 id 만 토글한다', () => {
    const on = toggleRow(org, { kind: 'user', id: 13 }, none, 'scope')
    expect(on).toEqual({ departmentIds: [], userIds: [13] })
    expect(toggleRow(org, { kind: 'user', id: 13 }, on, 'scope').userIds).toEqual([])
  })
})

describe('chipsOf · totalOf', () => {
  it('상위·하위 부서를 함께 지정해도 인원을 중복해서 세지 않는다', () => {
    // 회사(5명) + 개발본부(4명)를 단순 합산하면 9명이 되지만 실제로 덮이는 사람은 5명이다.
    expect(totalOf(org, { departmentIds: [1, 2], userIds: [11] })).toBe(5)
  })

  it('부서가 먼저 오고 상위 이름을 sub 로 쓴다. 개인은 소속 부서명', () => {
    const chips = chipsOf(org, { departmentIds: [10], userIds: [1] })
    expect(chips).toEqual([
      { key: 'd:10', kind: 'dept', id: 10, name: '개발팀', sub: '개발본부', count: 3 },
      { key: 'u:1', kind: 'user', id: 1, name: '대표', sub: '테스트 회사', count: 1 },
    ])
    expect(totalOf(org, { departmentIds: [10], userIds: [1] })).toBe(4)
  })

  it('겸직이라도 개인 칩은 하나다', () => {
    const chips = chipsOf(org, { departmentIds: [], userIds: [14] })
    expect(chips).toHaveLength(1)
    expect(chips[0]).toMatchObject({ id: 14, sub: '개발팀' })
  })

  it('루트를 고르면 sub 는 「전체」다', () => {
    expect(chipsOf(org, { departmentIds: [1], userIds: [] })[0].sub).toBe('전체')
  })
})

describe('orgDiff', () => {
  it('추가·삭제를 갈라 담고 겹치지 않게 한다', () => {
    const diff = orgDiff(
      { departmentIds: [10], userIds: [1, 2] },
      { departmentIds: [10, 11], userIds: [2, 3] },
    )
    expect(diff).toEqual({
      insertDepartmentIds: [11],
      deleteDepartmentIds: [],
      insertUserIds: [3],
      deleteUserIds: [1],
    })
    expect(isEmptyDiff(diff)).toBe(false)
  })

  it('변화가 없으면 빈 diff 다', () => {
    const same = { departmentIds: [10], userIds: [1] }
    expect(isEmptyDiff(orgDiff(same, { ...same }))).toBe(true)
  })
})
