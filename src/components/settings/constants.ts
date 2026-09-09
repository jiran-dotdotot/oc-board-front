// 환경 설정 도메인 상수. 인라인 리터럴 금지 규약 — 화면은 여기서만 값을 읽는다.
import type { AddDraft, BType, EnvTab, NodeKind } from './types'

/**
 * 탭 3개. 일반=전원, 메인화면=오피스 관리자, 게시판 관리=관리 권한 보유자.
 * 정본(통합 앱 web:1163 · mob:1089)은 회색 필 탭이고 좌측 레일은 `display:none` 이다.
 */
export const TABS: { id: EnvTab; label: 'env-tab-general' | 'env-tab-main' | 'env-tab-content' }[] =
  [
    { id: 'general', label: 'env-tab-general' },
    { id: 'main', label: 'env-tab-main' },
    { id: 'content', label: 'env-tab-content' },
  ]

export const TYPE_KEY: Record<
  NodeKind,
  'admin-add-cat' | 'admin-add-folder' | 'admin-add-board' | 'admin-add-drive'
> = {
  cat: 'admin-add-cat',
  folder: 'admin-add-folder',
  board: 'admin-add-board',
  drive: 'admin-add-drive',
}

export const BTYPE_KEY: Record<
  BType,
  'admin-btype-basic' | 'admin-btype-preview' | 'admin-btype-album'
> = {
  BOARD: 'admin-btype-basic',
  PREVIEW: 'admin-btype-preview',
  ALBUM: 'admin-btype-album',
}

/** 게시판 타입 라디오 순서(정본 web:1297-1299). `DRIVE` 는 트리 종류로 갈라져 여기 없다. */
export const BTYPE_OPTIONS: BType[] = ['BOARD', 'PREVIEW', 'ALBUM']

/** 자료실 용량 칩(정본 아트보드 `화면 09:926-927`). */
export const FILE_MAX_OPTS = ['100MB', '500MB', '1GB']
export const TOTAL_MAX_OPTS = ['5GB', '10GB', '50GB']

/** 이름 입력 상한 — 정본은 `slice(0,60)`, 레거시도 `maxlength=60`. */
export const NAME_MAX = 60
/** 게시판 설명 상한 — 레거시 `maxlength=300`. */
export const DESC_MAX = 300

/** 트리 들여쓰기(px): 카테고리 · 폴더/직속 게시판 · 폴더 안 게시판. */
export const TREE_PAD = { cat: 10, child: 28, leaf: 46 } as const

/** 추가 모달의 초기 초안. 정본 아트보드의 데모 state 가 아니라 «생성 기본값»이다. */
export function emptyDraft(loc: string): AddDraft {
  return {
    name: '',
    desc: '',
    loc,
    scope: 'all',
    scopeLabel: '',
    btype: 'BOARD',
    alarm: true,
    active: true,
    fileMax: FILE_MAX_OPTS[1],
    totalMax: TOTAL_MAX_OPTS[1],
    ext: '',
    admins: [],
  }
}
