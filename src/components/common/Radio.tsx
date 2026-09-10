/**
 * 라디오 한 칸. 정본 17px 원 · 선택 = primary 5px 링 · 미선택 = gray-300 1.5px
 * (통합 앱 web:1298·:788). hover 는 정본 규칙(border gray-400 + bg gray-50).
 * `role="radio"` + `aria-checked` 로 상태를 색 밖으로도 전달한다 — 부모가 `role="radiogroup"` 을 준다.
 */
export function Radio({
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
      role="radio"
      aria-checked={on}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-[7px] disabled:opacity-40"
    >
      <span
        aria-hidden="true"
        className={[
          'box-border inline-block size-[17px] flex-none rounded-full bg-card',
          on
            ? 'border-[5px] border-primary'
            : 'border-[1.5px] border-gray-300 hover:border-gray-400 hover:bg-gray-50',
        ].join(' ')}
      />
      <span className="text-sm text-gray-800">{label}</span>
    </button>
  )
}
