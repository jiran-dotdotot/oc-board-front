// 마이페이지/내 활동(화면 08) 데모 데이터 — 통합 앱 기준: 다열 그리드(위치·조회·공감·삭제자·등록일)

export const ME = {
  initial: '김',
  name: '김민준',
  meta: '경영지원본부 · 과장 · minjun.kim@jiran.com',
  comments: 132,
}

export type ChipKey = 'important' | 'my' | 'draft' | 'schedule' | 'trash'

export interface MyRow {
  title: string
  where: string // 위치(게시판/자료실)
  when: string // 주요 날짜(작성/저장/예약/삭제일)
  views?: number
  likes?: number
  by?: string // 삭제자(휴지통)
  created?: string // 등록일(휴지통)
  isFile?: boolean
  ext?: string
  tagBg?: string
  isNotice?: boolean
  hasFile?: boolean
  cmt?: number
  isBookmark?: boolean // 중요(별표)
  action?: 'continue'
  dim?: boolean
}

// 중요 = 내가 북마크한 글+자료
export const IMPORTANT: MyRow[] = [
  {
    title: '[필독] 사내 보안 정책 개정 안내 (VPN 접속 절차 변경)',
    where: '공지사항',
    when: '2026.08.03',
    isNotice: true,
    hasFile: true,
    isBookmark: true,
  },
  {
    title: 'VPN 설치 가이드_v2.pdf',
    where: '자료실 > 팀 자료',
    when: '2026.08.03',
    isFile: true,
    ext: 'PDF',
    tagBg: 'bg-l-red',
    isBookmark: true,
  },
  {
    title: '3분기 OKR 중간 점검 자료 공유',
    where: '공지사항',
    when: '2026.07.18',
    cmt: 7,
    isBookmark: true,
  },
  {
    title: '전사 워크샵 단체사진_원본.png',
    where: '자료실 > 워크샵',
    when: '2026.08.07',
    isFile: true,
    ext: 'PNG',
    tagBg: 'bg-l-purple',
    isBookmark: true,
  },
]

export const MY_POSTS: MyRow[] = [
  {
    title: '8월 전사 정기 점검 — 서비스 일시 중단 안내',
    where: '공지사항',
    when: '2026.08.01',
    isNotice: true,
    views: 892,
    likes: 15,
    cmt: 3,
  },
  {
    title: '상반기 비용 정산 마감 안내',
    where: '경영지원 소식',
    when: '2026.07.15',
    views: 340,
    likes: 9,
    hasFile: true,
  },
  {
    title: '사내 동호회 지원 신청 결과',
    where: '자유게시판',
    when: '2026.07.02',
    views: 512,
    likes: 22,
    cmt: 28,
  },
]

export const DRAFTS: MyRow[] = [
  { title: '(제목 없음)', where: '자유게시판', when: '오늘 11:20', action: 'continue', dim: true },
  {
    title: '하반기 채용 일정 공지 초안',
    where: '공지사항',
    when: '2026.08.08',
    action: 'continue',
  },
  { title: '워크샵 조 편성 안내', where: '자유게시판', when: '2026.08.05', action: 'continue' },
]

export const SCHEDULED: MyRow[] = [
  { title: '9월 급여 명세 발행 안내', where: '경영지원 소식', when: '2026.09.01 09:00' },
  { title: '추석 연휴 근무 지침', where: '공지사항', when: '2026.09.15 08:30', isNotice: true },
]

export const INITIAL_TRASH: MyRow[] = [
  {
    title: '점심 메뉴 추천 받습니다',
    where: '자유게시판',
    by: '김민준',
    created: '2026.07.20',
    when: '2026.08.01',
  },
  {
    title: '탕비실 간식 재고 공유.xlsx',
    where: '자료실',
    isFile: true,
    ext: 'XLSX',
    tagBg: 'bg-l-green',
    by: '김민준',
    created: '2026.07.10',
    when: '2026.07.30',
  },
  {
    title: '(구) 조직도_2025.pdf',
    where: '자료실',
    isFile: true,
    ext: 'PDF',
    tagBg: 'bg-l-red',
    by: '김민준',
    created: '2026.06.01',
    when: '2026.07.22',
  },
]

export const INITIAL_TRASH_CHECKS = [true, false, true]

// 칩별 그리드 컬럼 구성
export interface ColumnCfg {
  cols: string
  minW: string
  dateKey: 'my-col-writedate' | 'my-col-savedate' | 'my-col-scheddate' | 'my-col-deldate'
  stats: boolean
  action: boolean
  trash: boolean
}
export const COLUMN_CFG: Record<ChipKey, ColumnCfg> = {
  important: {
    cols: '16px minmax(0,1fr) 130px 96px',
    minW: '560px',
    dateKey: 'my-col-writedate',
    stats: false,
    action: false,
    trash: false,
  },
  my: {
    cols: '16px minmax(0,1fr) 130px 96px 56px 56px',
    minW: '660px',
    dateKey: 'my-col-writedate',
    stats: true,
    action: false,
    trash: false,
  },
  draft: {
    cols: '16px minmax(0,1fr) 130px 120px 96px',
    minW: '620px',
    dateKey: 'my-col-savedate',
    stats: false,
    action: true,
    trash: false,
  },
  schedule: {
    cols: '16px minmax(0,1fr) 130px 150px',
    minW: '560px',
    dateKey: 'my-col-scheddate',
    stats: false,
    action: false,
    trash: false,
  },
  trash: {
    cols: '16px minmax(0,1fr) 110px 96px 100px 100px',
    minW: '700px',
    dateKey: 'my-col-deldate',
    stats: false,
    action: false,
    trash: true,
  },
}
