/**
 * 공통 스위치. 정본 트랙 38×22 · knob 16 · on `primary` / off `gray-200`
 * (통합 앱 web:1203, 모바일은 40×23/knob 17 — 정본 편차가 1px 이라 한 치수로 둔다).
 * `role="switch"` + `aria-checked` 로 상태를 색 밖으로도 전달한다.
 */
export function Switch({
  on,
  onClick,
  label,
  disabled,
}: {
  on: boolean
  onClick: () => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={[
        'relative h-[22px] w-[38px] flex-none rounded-full transition-colors disabled:opacity-40',
        on ? 'bg-primary' : 'bg-gray-200',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-[3px] size-4 rounded-full bg-white shadow-sm transition-all',
          on ? 'left-[19px]' : 'left-[3px]',
        ].join(' ')}
      />
    </button>
  )
}
