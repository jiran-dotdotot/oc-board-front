// 관리자/콘텐츠 관리(화면 09) 데모 데이터 (백엔드 연동 전 — 추후 apiClient)
// 타입은 ./types.ts, 옵션·라벨 상수는 ./constants.ts 로 이관했다.
import type { Cat, Folder, Item } from './types'

export const INITIAL_CATS: Cat[] = [{ id: 'shared', name: '공용', fixed: true, scope: 'all' }]

export const INITIAL_FOLDERS: Folder[] = [
  { id: 'f1', name: '경영지원', cat: 'shared', scope: 'org' },
]

export const INITIAL_ITEMS: Item[] = [
  {
    id: 'notice',
    name: '공지사항',
    type: 'board',
    active: true,
    cat: 'shared',
    folder: null,
    scope: 'all',
    btype: 'BOARD',
    alarm: true,
  },
  {
    id: 'free',
    name: '자유게시판',
    type: 'board',
    active: true,
    cat: 'shared',
    folder: null,
    scope: 'all',
    btype: 'BOARD',
    alarm: false,
  },
  {
    id: 'hr',
    name: '인사팀 소식',
    type: 'board',
    active: true,
    cat: 'shared',
    folder: 'f1',
    scope: 'org',
    btype: 'PREVIEW',
    alarm: true,
  },
  {
    id: 'old',
    name: '구 자료 게시판',
    type: 'board',
    active: false,
    cat: 'shared',
    folder: null,
    scope: 'all',
    btype: 'BOARD',
    alarm: false,
  },
  {
    id: 'drive',
    name: '자료실',
    type: 'drive',
    active: true,
    cat: 'shared',
    folder: null,
    scope: 'all',
    alarm: true,
    fileMax: '500MB',
    totalMax: '10GB',
    exts: ['exe', 'bat'],
    admins: ['이서연'],
  },
]

// ── 조직도 (공개범위/관리자 지정 피커) ──
export interface OrgNode {
  id: string
  name: string
  parent: string | null
  count?: number
  members?: string[]
}

export const ORG: OrgNode[] = [
  { id: 'co', name: '오피스웨이브TF', parent: null },
  { id: 'mgmt', name: '경영지원본부', parent: 'co' },
  { id: 'hr', name: '인사팀', parent: 'mgmt', count: 8, members: ['정다은', '김하늘'] },
  { id: 'ga', name: '총무팀', parent: 'mgmt', count: 6, members: ['박준영'] },
  { id: 'dev', name: '개발본부', parent: 'co' },
  { id: 'be', name: '백엔드팀', parent: 'dev', count: 15, members: ['한서철', '이도현'] },
  { id: 'fe', name: '프론트엔드팀', parent: 'dev', count: 14, members: ['최연연', '김서준'] },
  { id: 'mob', name: '모바일팀', parent: 'dev', count: 12, members: ['한기율'] },
  { id: 'biz', name: '사업본부', parent: 'co' },
  { id: 'os', name: '해외영업팀', parent: 'biz', count: 7, members: ['신기기'] },
  { id: 'ds1', name: '국내영업1팀', parent: 'biz', count: 9, members: ['이서연'] },
  { id: 'ds2', name: '국내영업2팀', parent: 'biz', count: 8, members: ['오세훈'] },
  { id: 'mk', name: '마케팅팀', parent: 'biz', count: 6, members: ['장미래'] },
  { id: 'design', name: '디자인팀', parent: 'co', count: 6, members: ['유지호'] },
  { id: 'lab', name: '연구소', parent: 'co', count: 13, members: ['백상훈'] },
]

export const orgById = (id: string) => ORG.find((n) => n.id === id)
export const orgKids = (id: string | null) => ORG.filter((n) => n.parent === id)
export const isTeam = (n?: OrgNode) => !!n?.count
export function teamsUnder(id: string): string[] {
  const n = orgById(id)
  if (!n) return []
  return isTeam(n) ? [id] : orgKids(id).reduce<string[]>((a, k) => a.concat(teamsUnder(k.id)), [])
}
export const countUnder = (id: string) =>
  teamsUnder(id).reduce((a, t) => a + (orgById(t)?.count ?? 0), 0)
