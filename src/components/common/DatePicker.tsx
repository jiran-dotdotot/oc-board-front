import { useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'

import { Modal } from '@/components/common/Modal'
import { ChevronIcon } from '@/components/common/icons'

/**
 * 달력 모달 — 정본 `calVisible` 블록(통합 앱 web:1625-1660). 공지 기간·예약 발행이 함께 쓴다.
 *  - 302px · radius 16 · padding 16 · 셀 34px 원 · 요일 11/600(일=danger·토=primary)
 *  - 오늘 = ov-blue-300 인셋 링, 선택 = primary 채움, min/max 밖 = gray-300 · 비활성
 *  - `withTime` 이면 하단에 시간 칩(정본 4개) + 「분은 5분 단위」 안내.
 *    ⚠️ 가정(A8): 칩만으로는 임의 시각을 못 고르므로 `<input type="time" step=300>` 을 함께 둔다.
 * 값은 로컬 문자열 — 날짜 `YYYY-MM-DD`, 일시 `YYYY-MM-DDTHH:mm`.
 */
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

export function DatePicker({
  title,
  value,
  min,
  max,
  withTime,
  quickTimes = [],
  onPick,
  onClose,
}: {
  title: string
  value: string
  /** `YYYY-MM-DD` — 이보다 이전 날짜는 고를 수 없다. */
  min?: string
  max?: string
  withTime?: boolean
  quickTimes?: readonly string[]
  onPick: (next: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [date, time] = value.split('T')
  const seed = new Date(`${date || ymd(new Date().getFullYear(), new Date().getMonth(), 1)}T00:00`)
  const [y, setY] = useState(seed.getFullYear())
  const [m, setM] = useState(seed.getMonth())
  const today = (() => {
    const n = new Date()
    return ymd(n.getFullYear(), n.getMonth(), n.getDate())
  })()

  // ESC 는 호출부 몫(Modal 규약) — 달력은 자기 자신만 닫는다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const first = new Date(y, m, 1).getDay()
  const days = new Date(y, m + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array<null>(first).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ]
  const heads = [
    t('cal-sun'),
    t('cal-mon'),
    t('cal-tue'),
    t('cal-wed'),
    t('cal-thu'),
    t('cal-fri'),
    t('cal-sat'),
  ]

  const pick = (d: string, tm = time) => onPick(withTime ? `${d}T${tm || '09:00'}` : d)
  const prev = () => (m === 0 ? (setY(y - 1), setM(11)) : setM(m - 1))
  const next = () => (m === 11 ? (setY(y + 1), setM(0)) : setM(m + 1))

  return (
    <Modal onClose={onClose} label={title}>
      <div className="flex w-[302px] max-w-[92vw] flex-col gap-2.5 rounded-2xl border border-gray-200 bg-card p-4 shadow-[var(--shadow-modal)]">
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-px">
            <span className="text-xs text-gray-400">{title}</span>
            <span className="text-base font-extrabold tracking-title">
              {y}.{pad(m + 1)}
            </span>
          </div>
          <div className="ml-auto flex gap-0.5">
            <button
              type="button"
              onClick={prev}
              aria-label={t('cal-prev')}
              className="inline-flex size-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
            >
              <ChevronIcon className="rotate-180" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label={t('cal-next')}
              className="inline-flex size-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
            >
              <ChevronIcon />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {heads.map((h, i) => (
            <span
              key={h}
              className={`inline-flex h-6 items-center justify-center text-2xs font-semibold ${i === 0 ? 'text-destructive' : i === 6 ? 'text-primary' : 'text-gray-400'}`}
            >
              {h}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5" role="grid">
          {cells.map((d, i) => {
            if (d === null) return <span key={`e${i}`} />
            const v = ymd(y, m, d)
            const disabled = (!!min && v < min) || (!!max && v > max)
            const selected = v === date
            return (
              <button
                key={v}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                aria-current={v === today ? 'date' : undefined}
                onClick={() => pick(v)}
                className={[
                  'inline-flex h-[34px] items-center justify-center rounded-full text-s',
                  selected
                    ? 'bg-primary font-bold text-white'
                    : disabled
                      ? 'text-gray-300'
                      : 'text-gray-800 hover:bg-gray-100',
                  v === today && !selected
                    ? 'shadow-[inset_0_0_0_1.5px_var(--color-ov-blue-300)]'
                    : '',
                ].join(' ')}
              >
                {d}
              </button>
            )
          })}
        </div>
        {withTime && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-3">
            <span className="mr-0.5 text-xs font-semibold text-gray-600">
              {t('write-cal-time')}
            </span>
            {quickTimes.map((tm) => (
              <button
                key={tm}
                type="button"
                aria-pressed={time === tm}
                onClick={() => date && pick(date, tm)}
                className={`inline-flex h-7 items-center rounded-full px-[11px] text-xs font-semibold ${time === tm ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {tm}
              </button>
            ))}
            <input
              type="time"
              step={300}
              value={time ?? ''}
              aria-label={t('write-cal-time')}
              onChange={(e) => date && e.target.value && pick(date, e.target.value)}
              className="h-7 rounded-md border border-gray-200 bg-card px-2 text-xs text-gray-800"
            />
            <span className="w-full text-2xs text-gray-400">{t('write-cal-time-note')}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
