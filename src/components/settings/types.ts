// 환경 설정 화면의 도메인 타입. 트리는 Go 카테고리 트리(`CategoryTree`)에서 파생한다.
import type { Category, CategoryBoard } from '@/types/category'

export type EnvTab = 'general' | 'main' | 'content'

/**
 * 트리 노드 종류.
 * - `cat` = root 카테고리(depth 1) · `folder` = 자식 카테고리(depth 2)
 *   Go 는 2단까지만 만들고 `parent_category_id` 로 옮길 수 없다(03-category.md:52,459).
 * - `board` / `drive` = 게시판(`type` 이 `DRIVE` 면 자료실)
 */
export type NodeKind = 'cat' | 'folder' | 'board' | 'drive'

/** 「공용」 고정 노드의 id. Go 에 그런 카테고리 «행»은 없다 — `category_id=null` 묶음이다. */
export const PUBLIC_CAT_ID = '__public__'

/** 평탄화된 트리 행. `parentCat`/`parentFolder` 는 형제 판정과 정렬 범위에 쓴다. */
export interface SettingsNode {
  kind: NodeKind
  id: string
  name: string
  /** 들여쓰기 단계 0·1·2. */
  depth: 0 | 1 | 2
  position: number
  paused: boolean
  /** 공개 범위가 조직 지정인지 — grant 가 하나라도 있으면 참. */
  scoped: boolean
  parentCat: string | null
  parentFolder: string | null
  /** 이름·설정을 저장할 수 있는가. */
  canManage: boolean
  /** 삭제할 수 있는가. 게시판은 **회사·카테고리 관리자만**이라 canManage 보다 좁다. */
  canDelete: boolean
  /** 「공용」 가상 노드 — 편집·삭제 대상이 아니다. */
  fixed?: boolean
  /** 원본 참조 — 상세 패널 초안을 동기적으로 만든다(grant 만 따로 조회). */
  board?: CategoryBoard
  category?: Category
}

export type DropPos = 'before' | 'after'

/** 공개 범위. `all` = 전체 공개, `org` = 조직 지정(부서·구성원 grant). */
export type ScopeMode = 'all' | 'org'

/**
 * 추가 모달 초안.
 * 「공개 범위」는 정본에서 **필수**(`*`)다 — `org` 인데 대상이 비면 저장을 막는다.
 */
export interface AddDraft {
  name: string
  desc: string
  scope: ScopeMode
  /** 조직 지정일 때 고른 부서·구성원. 게시판은 상위 카테고리 범위 안에서만 고를 수 있다. */
  org: import('@/types/department').OrgSelection
  /** 관리자로 지정할 사용자 id. 부서 grant 는 없다(사용자만). */
  admins: number[]
  /** `cat:<id>` 또는 `fol:<id>`. 카테고리 추가에는 쓰지 않는다. */
  loc: string
  btype: Exclude<import('@/types/category').BoardType, 'DRIVE'>
  alarm: boolean
  active: boolean
  /** 용량 칩 라벨(`'500MB'`). 전송 직전에 byte 로 바꾼다. */
  fileMax: string
  totalMax: string
  ext: string
}

/** 상세 패널이 편집하는 값. 서버 필드명이 아니라 화면 값이다(`name` → `title`). */
export interface NodeDraft {
  name: string
  type: import('@/types/category').BoardType
  is_active: boolean
  is_post_alarm: boolean
  /** byte. null = 제한 없음. 자료실에서만 의미가 있다. */
  size_limit: number | null
  size_limit_per_file: number | null
  except_extension: string[]
}
