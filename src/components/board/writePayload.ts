// 글쓰기 폼 값 → Go 요청 body. **순수 함수만** 둔다 — 화면과 테스트가 같은 걸 본다.
// 계약: docs/api/go/06-post-write.md:212-222(POST) · :272-286(PUT) · :58-67(badges) · :15(날짜 파서).
import { NOTICE_FOREVER_YEAR, SCHEDULE_DEFAULT_OFFSET_MS, SCHEDULE_STEP_MIN } from './constants'
import type {
  PostBadge,
  PostDetail,
  PostUpdateBody,
  PostWriteBody,
  PostWriteState,
} from '@/types/post'

export type PublishMode = 'now' | 'schedule'
export type NoticeMode = 'always' | 'period'
export type SaveIntent = 'draft' | 'publish'

/** 폼 값. 날짜는 전부 «로컬» 문자열 — 일시 `YYYY-MM-DDTHH:mm`, 날짜 `YYYY-MM-DD`. */
export interface WriteFormValues {
  boardId: string
  title: string
  publish: PublishMode
  scheduleAt: string
  noticeOn: boolean
  noticeMode: NoticeMode
  noticeFrom: string
  noticeTo: string
  allowComment: boolean
  commentAlarm: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

/** `Date` → 로컬 `YYYY-MM-DDTHH:mm` (폼 값). */
export function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 로컬 `YYYY-MM-DD` (폼 값). */
export function toLocalDate(d: Date): string {
  return toLocalInput(d).slice(0, 10)
}

/**
 * ⚠️ 가정(A2): 서버엔 **RFC3339 + 로컬 오프셋**으로 보낸다(`2026-09-11T10:00:00+09:00`).
 * 공통 파서 3종 중 하나다(06:15). `YYYY-MM-DD HH:mm:ss` 는 `Time_zone` 헤더에 의존해 해석되므로
 * 오프셋을 명시하는 쪽이 헤더 누락·오해석에 덜 취약하다. 공백은 trim 하지 않으니 넣지 않는다.
 */
export function toRfc3339Local(local: string): string {
  const d = new Date(local)
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const abs = Math.abs(off)
  return `${toLocalInput(d)}:${pad(d.getSeconds())}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/** 예약 기본값 — 지금 + 1시간, 분은 5분 단위로 올림(레거시 :103 · 정본 「5분 단위」). */
export function defaultScheduleAt(now = new Date()): string {
  const d = new Date(now.getTime() + SCHEDULE_DEFAULT_OFFSET_MS)
  const step = SCHEDULE_STEP_MIN * 60 * 1000
  return toLocalInput(new Date(Math.ceil(d.getTime() / step) * step))
}

/** 과거 시각이면 true — 「현재 이후 시각을 선택해주세요.」(레거시 :325-329 와 같은 규칙). */
export function isPastSchedule(local: string, now = new Date()): boolean {
  const t = new Date(local).getTime()
  return Number.isNaN(t) || t <= now.getTime()
}

/** 상태 결정 — 레거시 삼항(AddPostView.vue:209·324)과 같다. */
export function resolveState(intent: SaveIntent, publish: PublishMode): PostWriteState {
  if (intent === 'draft') return 'SAVE'
  return publish === 'schedule' ? 'SCHEDULED' : 'ACT'
}

/**
 * 공지 뱃지 body. ⚠️ 가정(A1·A3):
 * - 항상 고정: 시작 = 지금, 종료 = 로컬 2999-12-31 23:59:59 (Go 는 「명시적 2999년 종료값」만 지시, 06:67)
 * - 기간: 시작일 00:00:00 ~ 종료일 23:59:59 (정본은 시작~종료 두 칩, 레거시는 시작=now)
 */
export function noticeBadge(
  mode: NoticeMode,
  from: string,
  to: string,
  now = new Date(),
): { start_date: string; end_date: string } {
  if (mode === 'always')
    return {
      start_date: toRfc3339Local(toLocalInput(now)),
      end_date: toRfc3339Local(`${NOTICE_FOREVER_YEAR}-12-31T23:59:59`),
    }
  return {
    start_date: toRfc3339Local(`${from}T00:00:00`),
    end_date: toRfc3339Local(`${to}T23:59:59`),
  }
}

/** 응답 `end_date`(UTC) 가 무기한 표현(연도 2999, 05:104)인지. */
export function isForeverBadge(b: Pick<PostBadge, 'end_date'>): boolean {
  return !!b.end_date && new Date(b.end_date).getFullYear() >= NOTICE_FOREVER_YEAR
}

/** 살아 있는 NOTICE 뱃지 — 상세 `badges[]` 는 만료·미래 뱃지도 포함하므로 `is_active` 로 고른다(05:110). */
export function activeNotice(badges: PostBadge[] | undefined): PostBadge | undefined {
  return badges?.find((b) => b.type === 'NOTICE' && b.is_active !== false)
}

function common(values: WriteFormValues, content: string): PostWriteBody {
  return {
    title: values.title,
    content,
    is_allow_comment: values.allowComment,
    // 댓글 허용을 끄면 알림도 꺼진다(레거시 :985).
    is_comment_alarm: values.allowComment && values.commentAlarm,
  }
}

/**
 * 새 글. `badges` 는 공지 ON 이고 CanManage 일 때만 — 아니면 서버가 403 을 낸다(06:228).
 * 예약은 publish 의도에서만 `schedule_at` 을 싣는다. 임시저장은 예약값을 «보관»하기 위해서도 싣는다
 * (SAVE 에서 새 schedule_at 은 저장된다, 06:300).
 */
export function buildCreateBody(
  values: WriteFormValues,
  content: string,
  intent: SaveIntent,
  canManage: boolean,
  now = new Date(),
): PostWriteBody {
  const body: PostWriteBody = {
    ...common(values, content),
    state: resolveState(intent, values.publish),
  }
  if (values.publish === 'schedule' && values.scheduleAt)
    body.schedule_at = toRfc3339Local(values.scheduleAt)
  if (values.noticeOn && canManage)
    body.badges = [noticeBadge(values.noticeMode, values.noticeFrom, values.noticeTo, now)]
  return body
}

export interface UpdateOptions {
  canManage: boolean
  /** 원본이 ACT 인 글을 고칠 때 「알림 보내기」를 골랐는가. 아니면 `not_send_alarm:true`. */
  notifyEdit: boolean
  deleteFileIds: string[]
  deleteThumbnailId: string | null
}

/**
 * 기존 글 수정.
 * - `board_id` 는 원본이 SAVE 이고 바뀐 경우만(06:274) — ACT 글에 보내면 목적지 권한만 검사되고 이동은 안 된다.
 * - 예약 해제: SCHEDULED 글을 「현재」로 바꾸면 `state` 와 `delete_schedule_at:true` 를 함께 보낸다.
 *   `delete_schedule_at` 만 보내면 400 `POST_SCHEDULE_REQUIRED` 다(06:46).
 * - 공지 끄기 = `delete_badge_id:[기존 id]`(06:285). 레거시처럼 end_date 를 «지금»으로 덮지 않는다.
 * - `not_send_alarm` 은 원본 ACT 일 때만 의미가 있다(06:300 「ACT 결과면 무변경도 알림」).
 */
export function buildUpdateBody(
  values: WriteFormValues,
  content: string,
  intent: SaveIntent,
  original: PostDetail,
  opts: UpdateOptions,
  now = new Date(),
): PostUpdateBody {
  const state = resolveState(intent, values.publish)
  const body: PostUpdateBody = { ...common(values, content), state }

  if (original.state === 'SAVE' && values.boardId && values.boardId !== original.board_id)
    body.board_id = values.boardId

  if (values.publish === 'schedule' && values.scheduleAt) {
    body.schedule_at = toRfc3339Local(values.scheduleAt)
  } else if (original.state === 'SCHEDULED' || original.schedule_at) {
    body.delete_schedule_at = true
  }

  const existing = activeNotice(original.badges)
  if (values.noticeOn && opts.canManage) {
    body.badges = [noticeBadge(values.noticeMode, values.noticeFrom, values.noticeTo, now)]
  } else if (!values.noticeOn && existing?.id && opts.canManage) {
    body.delete_badge_id = [existing.id]
  }

  if (opts.deleteFileIds.length) body.delete_file_id = opts.deleteFileIds
  if (opts.deleteThumbnailId) body.delete_thumbnail_id = [opts.deleteThumbnailId]

  if (original.state === 'ACT' && !opts.notifyEdit) body.not_send_alarm = true

  return body
}

/** 수정 모드 프리필. 예약은 `schedule_at_tz`(요청 시간대의 `YYYY-MM-DD HH:mm:ss`, 06:13)로 복원한다. */
export function prefillFromPost(post: PostDetail, now = new Date()): WriteFormValues {
  const notice = activeNotice(post.badges)
  const scheduled = post.state !== 'ACT' && !!post.schedule_at_tz
  const today = toLocalDate(now)
  return {
    boardId: post.board_id,
    title: post.title ?? '',
    publish: scheduled ? 'schedule' : 'now',
    scheduleAt: scheduled
      ? post.schedule_at_tz!.slice(0, 16).replace(' ', 'T')
      : defaultScheduleAt(now),
    noticeOn: !!notice,
    noticeMode: notice && !isForeverBadge(notice) ? 'period' : 'always',
    noticeFrom:
      notice?.start_date && !isForeverBadge(notice)
        ? toLocalDate(new Date(notice.start_date))
        : today,
    noticeTo:
      notice?.end_date && !isForeverBadge(notice) ? toLocalDate(new Date(notice.end_date)) : today,
    allowComment: post.is_allow_comment ?? true,
    commentAlarm: post.is_comment_alarm ?? true,
  }
}

export function emptyFormValues(boardId = '', now = new Date()): WriteFormValues {
  const today = toLocalDate(now)
  return {
    boardId,
    title: '',
    publish: 'now',
    scheduleAt: defaultScheduleAt(now),
    noticeOn: false,
    noticeMode: 'always',
    noticeFrom: today,
    noticeTo: today,
    allowComment: true,
    commentAlarm: true,
  }
}

export type WriteErrorField = 'board' | 'schedule' | 'notice' | 'form'
export interface WriteErrorInfo {
  field: WriteErrorField
  key:
    | 'write-err-board-forbidden'
    | 'write-err-board-notfound'
    | 'write-err-schedule-required'
    | 'write-err-notice-period'
    | 'write-err-not-author'
    | 'write-err-notice-forbidden'
    | 'write-err-generic'
}

/**
 * Go 오류 → 필드별 메시지. **code 로 분기**하고 message 는 쓰지 않는다(README.md:95).
 * 검사 순서(06:228·:292): 게시판 404 → Write 403 → 날짜 400 → 뱃지 CanManage 403 →
 * POST_SCHEDULE_REQUIRED → BADGE_PERIOD_INVALID. 403 은 사유를 주지 않으므로 «뱃지를 보냈는가»로 가른다.
 */
export function mapWriteError(
  err: unknown,
  ctx: { sentBadges: boolean; editing: boolean },
): WriteErrorInfo {
  const e = err as { response?: { status?: number; data?: { error?: { code?: string } } } }
  const status = e?.response?.status
  const code = e?.response?.data?.error?.code
  if (code === 'POST_SCHEDULE_REQUIRED')
    return { field: 'schedule', key: 'write-err-schedule-required' }
  if (code === 'BADGE_PERIOD_INVALID') return { field: 'notice', key: 'write-err-notice-period' }
  if (status === 404) return { field: 'board', key: 'write-err-board-notfound' }
  if (status === 403) {
    if (ctx.sentBadges) return { field: 'notice', key: 'write-err-notice-forbidden' }
    if (ctx.editing) return { field: 'form', key: 'write-err-not-author' }
    return { field: 'board', key: 'write-err-board-forbidden' }
  }
  return { field: 'form', key: 'write-err-generic' }
}
