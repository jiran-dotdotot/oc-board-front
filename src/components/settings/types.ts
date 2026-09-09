// 환경 설정 화면의 도메인 타입.
// `Cat`/`Folder`/`Item` 은 데모 트리의 모양이다 — Go 배선 시 서버 트리로 대체된다.

export type EnvTab = 'general' | 'main' | 'content'

/** 트리 노드 종류. 「폴더」는 Go 의 depth 2 자식 카테고리다(docs/api/go/03-category.md:52). */
export type NodeKind = 'cat' | 'folder' | 'board' | 'drive'
export type Scope = 'all' | 'org'
export type BType = 'BOARD' | 'PREVIEW' | 'ALBUM'

export interface Cat {
  id: string
  name: string
  fixed?: boolean
  scope: Scope
  scopeLabel?: string
  admins?: string[]
}

export interface Folder {
  id: string
  name: string
  cat: string
  scope: Scope
  scopeLabel?: string
  admins?: string[]
}

export interface Item {
  id: string
  name: string
  desc?: string
  type: 'board' | 'drive'
  active: boolean
  cat: string
  folder: string | null
  scope: Scope
  scopeLabel?: string
  admins?: string[]
  alarm: boolean
  btype?: BType
  fileMax?: string
  totalMax?: string
  exts?: string[]
}

/** 트리를 평탄화한 행. `pad` 는 들여쓰기 px, `cat`/`folder` 는 형제 판정에 쓴다. */
export interface TreeNode {
  kind: NodeKind
  id: string
  name: string
  pad: number
  paused: boolean
  scoped: boolean
  cat: string | null
  folder: string | null
}

export type DropPos = 'before' | 'after'

/** 추가 모달이 모아 보내는 초안. */
export interface AddDraft {
  name: string
  desc: string
  loc: string
  scope: Scope
  scopeLabel: string
  btype: BType
  alarm: boolean
  active: boolean
  fileMax: string
  totalMax: string
  ext: string
  admins: string[]
}
