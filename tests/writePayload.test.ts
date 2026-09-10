import {
  type WriteFormValues,
  buildCreateBody,
  buildUpdateBody,
  defaultScheduleAt,
  emptyFormValues,
  isPastSchedule,
  mapWriteError,
  prefillFromPost,
  resolveState,
  toRfc3339Local,
} from '@/components/board/writePayload'
import type { PostDetail } from '@/types/post'
import { describe, expect, it } from 'vitest'

const NOW = new Date('2026-09-10T14:00:00')

const base: WriteFormValues = {
  ...emptyFormValues('b1', NOW),
  title: '제목',
}

const post = (extra: Partial<PostDetail> = {}): PostDetail =>
  ({
    id: 'p1',
    board_id: 'b1',
    state: 'SAVE',
    title: '기존',
    content: '<p>x</p>',
    badges: [],
    files: [],
    is_allow_comment: true,
    is_comment_alarm: false,
    ...extra,
  }) as PostDetail

describe('글쓰기 폼 → Go body', () => {
  it('state 는 의도·발행 모드로 결정된다(레거시 삼항과 동일)', () => {
    expect(resolveState('draft', 'now')).toBe('SAVE')
    expect(resolveState('draft', 'schedule')).toBe('SAVE')
    expect(resolveState('publish', 'now')).toBe('ACT')
    expect(resolveState('publish', 'schedule')).toBe('SCHEDULED')
  })

  it('날짜는 RFC3339 + 로컬 오프셋이고 공백이 없다(공통 파서 3종 중 하나, 06:15)', () => {
    const s = toRfc3339Local('2026-09-11T10:05')
    expect(s).toMatch(/^2026-09-11T10:05:00[+-]\d{2}:\d{2}$/)
    expect(s).not.toContain(' ')
  })

  it('예약 기본값은 now+1h 를 5분 단위로 올린 값이고, 과거 시각은 거절된다', () => {
    expect(defaultScheduleAt(new Date('2026-09-10T14:02:00'))).toBe('2026-09-10T15:05')
    expect(isPastSchedule('2026-09-10T13:59', NOW)).toBe(true)
    expect(isPastSchedule('2026-09-10T14:01', NOW)).toBe(false)
  })

  it('새 글 「현재」 발행 — schedule_at·badges 를 보내지 않는다', () => {
    const b = buildCreateBody(base, '<p>b</p>', 'publish', true, NOW)
    expect(b.state).toBe('ACT')
    expect(b).not.toHaveProperty('schedule_at')
    expect(b).not.toHaveProperty('badges')
    expect(b).not.toHaveProperty('delete_schedule_at')
    expect(b.is_allow_comment).toBe(true)
    expect(b.is_comment_alarm).toBe(true)
  })

  it('예약 발행 — SCHEDULED + schedule_at', () => {
    const b = buildCreateBody(
      { ...base, publish: 'schedule', scheduleAt: '2026-09-11T09:00' },
      '',
      'publish',
      false,
      NOW,
    )
    expect(b.state).toBe('SCHEDULED')
    expect(b.schedule_at).toMatch(/^2026-09-11T09:00:00/)
  })

  it('공지 항상 고정 = 종료 연도 2999, 기간 = 시작 00:00 ~ 종료 23:59:59', () => {
    const always = buildCreateBody({ ...base, noticeOn: true }, '', 'publish', true, NOW)
    expect(always.badges).toHaveLength(1)
    expect(always.badges![0].end_date).toMatch(/^2999-12-31T23:59:59/)
    const period = buildCreateBody(
      {
        ...base,
        noticeOn: true,
        noticeMode: 'period',
        noticeFrom: '2026-09-11',
        noticeTo: '2026-09-20',
      },
      '',
      'publish',
      true,
      NOW,
    )
    expect(period.badges![0].start_date).toMatch(/^2026-09-11T00:00:00/)
    expect(period.badges![0].end_date).toMatch(/^2026-09-20T23:59:59/)
    // badges[] 에 type 을 넣지 않는다 — 서버가 버린다(06:60)
    expect(period.badges![0]).not.toHaveProperty('type')
  })

  it('CanManage 가 아니면 공지를 켜도 badges 를 보내지 않는다(보내면 403)', () => {
    const b = buildCreateBody({ ...base, noticeOn: true }, '', 'publish', false, NOW)
    expect(b).not.toHaveProperty('badges')
  })

  it('댓글 허용을 끄면 알림도 꺼진다', () => {
    const b = buildCreateBody(
      { ...base, allowComment: false, commentAlarm: true },
      '',
      'draft',
      false,
    )
    expect(b.is_allow_comment).toBe(false)
    expect(b.is_comment_alarm).toBe(false)
  })

  const opts = { canManage: true, notifyEdit: false, deleteFileIds: [], deleteThumbnailId: null }

  it('수정: board_id 는 원본이 SAVE 이고 바뀐 경우에만', () => {
    const moved = buildUpdateBody({ ...base, boardId: 'b2' }, '', 'publish', post(), opts, NOW)
    expect(moved.board_id).toBe('b2')
    const same = buildUpdateBody(base, '', 'publish', post(), opts, NOW)
    expect(same).not.toHaveProperty('board_id')
    const act = buildUpdateBody(
      { ...base, boardId: 'b2' },
      '',
      'publish',
      post({ state: 'ACT' }),
      opts,
      NOW,
    )
    expect(act).not.toHaveProperty('board_id')
  })

  it('수정: SCHEDULED → 「현재」는 state 와 delete_schedule_at 을 함께 보낸다(06:46)', () => {
    const b = buildUpdateBody(
      base,
      '',
      'publish',
      post({ state: 'SCHEDULED', schedule_at: '2026-10-01T00:00:00.000000Z' }),
      opts,
      NOW,
    )
    expect(b.state).toBe('ACT')
    expect(b.delete_schedule_at).toBe(true)
    expect(b).not.toHaveProperty('schedule_at')
  })

  it('수정: 공지 끄기 = delete_badge_id, 켜기 = badges upsert', () => {
    const withBadge = post({
      badges: [
        { id: 'bg1', type: 'NOTICE', is_active: true, end_date: '2999-12-31T14:59:59.000000Z' },
      ],
    })
    const off = buildUpdateBody({ ...base, noticeOn: false }, '', 'publish', withBadge, opts, NOW)
    expect(off.delete_badge_id).toEqual(['bg1'])
    expect(off).not.toHaveProperty('badges')
    const on = buildUpdateBody({ ...base, noticeOn: true }, '', 'publish', withBadge, opts, NOW)
    expect(on.badges).toHaveLength(1)
    expect(on).not.toHaveProperty('delete_badge_id')
  })

  it('수정: not_send_alarm 은 원본 ACT 에서 «알림 안 보냄»일 때만', () => {
    expect(
      buildUpdateBody(base, '', 'publish', post({ state: 'ACT' }), opts, NOW).not_send_alarm,
    ).toBe(true)
    expect(
      buildUpdateBody(
        base,
        '',
        'publish',
        post({ state: 'ACT' }),
        { ...opts, notifyEdit: true },
        NOW,
      ),
    ).not.toHaveProperty('not_send_alarm')
    expect(buildUpdateBody(base, '', 'publish', post(), opts, NOW)).not.toHaveProperty(
      'not_send_alarm',
    )
  })

  it('수정: 첨부·썸네일 삭제 id 를 싣는다', () => {
    const b = buildUpdateBody(
      base,
      '',
      'draft',
      post(),
      { ...opts, deleteFileIds: ['f1', 'f2'], deleteThumbnailId: 't1' },
      NOW,
    )
    expect(b.delete_file_id).toEqual(['f1', 'f2'])
    expect(b.delete_thumbnail_id).toEqual(['t1'])
  })

  it('프리필: schedule_at_tz 로 예약을, 연도 2999 로 항상 고정을 복원한다', () => {
    const v = prefillFromPost(
      post({
        state: 'SCHEDULED',
        schedule_at_tz: '2026-10-01 09:30:00',
        badges: [
          {
            id: 'bg1',
            type: 'NOTICE',
            is_active: true,
            start_date: '2026-09-01T00:00:00Z',
            end_date: '2999-12-31T14:59:59Z',
          },
        ],
      }),
      NOW,
    )
    expect(v.publish).toBe('schedule')
    expect(v.scheduleAt).toBe('2026-10-01T09:30')
    expect(v.noticeOn).toBe(true)
    expect(v.noticeMode).toBe('always')
    expect(v.commentAlarm).toBe(false)
  })

  it('오류는 code → status 순으로 필드에 매핑한다', () => {
    const err = (status: number, code?: string) => ({
      response: { status, data: code ? { error: { code } } : {} },
    })
    expect(
      mapWriteError(err(400, 'POST_SCHEDULE_REQUIRED'), { sentBadges: false, editing: false })
        .field,
    ).toBe('schedule')
    expect(
      mapWriteError(err(400, 'BADGE_PERIOD_INVALID'), { sentBadges: true, editing: false }).field,
    ).toBe('notice')
    expect(mapWriteError(err(404), { sentBadges: false, editing: false }).key).toBe(
      'write-err-board-notfound',
    )
    expect(mapWriteError(err(403), { sentBadges: true, editing: false }).key).toBe(
      'write-err-notice-forbidden',
    )
    expect(mapWriteError(err(403), { sentBadges: false, editing: true }).key).toBe(
      'write-err-not-author',
    )
    expect(mapWriteError(err(403), { sentBadges: false, editing: false }).key).toBe(
      'write-err-board-forbidden',
    )
    expect(mapWriteError(new Error('x'), { sentBadges: false, editing: false }).key).toBe(
      'write-err-generic',
    )
  })
})
