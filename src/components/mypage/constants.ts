// 내 활동(화면 08) 화면 상수. 인라인 리터럴을 컴포넌트에 두지 않는다.
import type { ChipKey, MyTab } from '@/components/mypage/myParams'

export const CHIP_LABEL_KEY = {
  important: 'my-chip-important',
  my: 'my-chip-my',
  draft: 'my-chip-draft',
  schedule: 'my-chip-schedule',
  trash: 'my-chip-trash',
} as const satisfies Record<ChipKey, string>

export const TAB_LABEL_KEY = {
  post: 'my-tab-post',
  file: 'my-tab-file',
} as const satisfies Record<MyTab, string>

/** 칩별 빈 상태 문구. 「휴지통이 비어 있습니다」만 있던 걸 칩별로 나눴다. */
export const EMPTY_KEY = {
  important: 'my-empty-important',
  my: 'my-empty-my',
  draft: 'my-empty-draft',
  schedule: 'my-empty-schedule',
  trash: 'my-empty-trash',
} as const satisfies Record<ChipKey, string>

/**
 * 자료 휴지통 보관 기간(일).
 * ⚠ **서버가 주지 않는 값이다** — Go 는 매일 UTC00:00 배치가 `deleted_at ≤ now−30일` 을
 *   purge 한다고만 적혀 있고(09-drive-file.md:635) API 로 노출하지 않는다. → BR-039.
 * ⚠ 게시글에는 붙이지 않는다. 게시글은 「30일 후 행 삭제」 worker 자체가 등록돼 있지 않다
 *   (06-post-write.md:43) — 같은 문구를 달면 사실과 다른 안내가 된다.
 */
export const TRASH_KEEP_DAYS = 30

// 칩별 그리드 컬럼 구성
export interface ColumnCfg {
  cols: string
  minW: string
  dateKey: 'my-col-writedate' | 'my-col-savedate' | 'my-col-scheddate' | 'my-col-deldate'
  /** 조회·공감 컬럼. 게시글에만 있는 값이라 자료 탭에서는 항상 false 다. */
  stats: boolean
  /** 행 우측 액션 버튼(임시저장 「이어쓰기」) */
  action: boolean
  /** 삭제자·등록일 컬럼 */
  trash: boolean
}

const CFG = {
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
  // 자료에는 조회수·공감이 없다(DriveFileDTO 09:59-79) → 두 컬럼을 뺀 변형
  myFile: {
    cols: '16px minmax(0,1fr) 130px 96px',
    minW: '560px',
    dateKey: 'my-col-writedate',
    stats: false,
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
} as const satisfies Record<ChipKey | 'myFile', ColumnCfg>

export function columnCfg(chip: ChipKey, tab: MyTab): ColumnCfg {
  return chip === 'my' && tab === 'file' ? CFG.myFile : CFG[chip]
}
