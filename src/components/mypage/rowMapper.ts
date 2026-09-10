// Go DTO → 내 활동 행 뷰모델. 순수 함수 — 날짜 포맷·확장자 색은 공용 util 을 그대로 쓴다.
import type { ChipKey } from '@/components/mypage/myParams'
import { EXT_BG, EXT_BG_DEFAULT } from '@/constants/fileExt'
import type { ApiDriveFile } from '@/types/drive'
import type { Post } from '@/types/post'
import { fmtSize } from '@/components/drive/driveData'
import { fmtDate, fmtDateTime } from '@/utils/date'

export interface MyRow {
  id: string
  kind: 'post' | 'file'
  title: string
  /** 위치(게시판/자료실 이름) */
  where: string
  /** 칩별 주요 날짜(작성/저장/예약/삭제일) */
  when: string
  views?: number
  likes?: number
  /** 삭제자 (휴지통) */
  by?: string
  /** 등록일 (휴지통) */
  created?: string
  isFile?: boolean
  ext?: string
  tagBg?: string
  isNotice?: boolean
  hasFile?: boolean
  cmt?: number
  isBookmark?: boolean
  /**
   * 모바일 한 줄 메타. 정본 모바일은 컬럼 표가 아니라 「제목 + 메타 한 줄」 카드다
   * (개선안 통합 앱 mobile.dc.html:1044) — 데스크톱 컬럼과 같은 값을 «·» 로 잇는다.
   */
  meta: string
}

/**
 * 칩별 「주요 날짜」. 컬럼 라벨(작성일/저장일/예약일/삭제일)과 값이 어긋나면 안 된다.
 * 예약은 `schedule_at_tz`(요청 타임존의 `YYYY-MM-DD HH:mm:ss`, 05:154)라 시각까지 보여준다.
 */
function postDate(p: Post, chip: ChipKey): string {
  if (chip === 'trash') return fmtDate(p.deleted_at)
  if (chip === 'draft') return fmtDateTime(p.updated_at)
  if (chip === 'schedule') return fmtDateTime(p.schedule_at_tz)
  return fmtDate(p.posted_at ?? p.created_at)
}

const join = (parts: (string | undefined | null)[]) => parts.filter(Boolean).join(' · ')

export function postToRow(p: Post, chip: ChipKey, untitled: string): MyRow {
  const title = p.title?.trim()
  const when = postDate(p, chip)
  return {
    id: p.id,
    kind: 'post',
    title: title || untitled,
    where: p.board?.title ?? '',
    when,
    meta:
      chip === 'trash'
        ? join([p.board?.title, p.delete_user?.name, when])
        : join([p.board?.title, p.user?.name, when]),
    views: p.view_count,
    likes: p.like_count,
    by: p.delete_user?.name ?? '',
    created: fmtDate(p.created_at),
    // NOTICE 배지는 만료·예정분도 함께 오므로 is_active 로 걸러야 한다(05:110).
    isNotice: (p.badges ?? []).some((b) => b.type === 'NOTICE' && b.is_active !== false),
    hasFile: (p.files ?? []).length > 0,
    cmt: p.comment_count,
    isBookmark: !!p.is_bookmark,
  }
}

export function fileToRow(f: ApiDriveFile, chip: ChipKey): MyRow {
  const ext = (f.extension ?? '').toUpperCase()
  const when = chip === 'trash' ? fmtDate(f.deleted_at) : fmtDate(f.created_at)
  return {
    id: f.id,
    kind: 'file',
    title: f.origin_file_name,
    where: f.board?.title ?? '',
    // 파일에는 posted_at·schedule 이 없다. 휴지통만 삭제일, 나머지는 등록일이다.
    when,
    meta:
      chip === 'trash'
        ? join([f.board?.title, f.delete_user?.name, when, fmtSize(f.size)])
        : join([f.board?.title, when, fmtSize(f.size)]),
    by: f.delete_user?.name ?? '',
    created: fmtDate(f.created_at),
    isFile: true,
    ext,
    tagBg: EXT_BG[ext] ?? EXT_BG_DEFAULT,
    isBookmark: !!f.is_bookmark,
  }
}
