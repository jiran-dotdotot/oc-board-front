import { CheckIcon, DashIcon } from '@/components/common/icons'

/* 목록 선택 체크박스 (정본: 15px, radius 4, border 1.5px, 체크는 stroke 3.4).
   자료실·마이페이지가 함께 쓴다 — 개별 화면에 복사하지 말 것. */
export function Checkbox({
  checked,
  mixed,
  onClick,
  label,
}: {
  checked: boolean
  /** 부분 선택 — 대시로 표시. 색 대비만으로 상태를 전하지 않기 위한 형태 신호다. */
  mixed?: boolean
  onClick: () => void
  /** 접근 이름 — 필수다. 이름 없는 role="checkbox" 는 스크린리더가 「체크박스」로만 읽어
      무엇을 고르는지 알 수 없다(WCAG 4.1.2). 「전체 선택」처럼 대상이 목록이면 그 문구를 넣는다. */
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="checkbox"
      aria-checked={checked ? true : mixed ? 'mixed' : false}
      aria-label={label}
      className={[
        'inline-flex size-[15px] flex-none items-center justify-center rounded border-[1.5px] text-white',
        // 켜진 모양은 checked/mixed 에서 파생된다 — 호출부가 따로 넘길 값이 아니었다.
        checked || mixed
          ? 'border-primary bg-primary'
          : 'border-gray-300 bg-card hover:border-gray-400 hover:bg-gray-50',
      ].join(' ')}
    >
      {checked ? <CheckIcon strokeWidth={3.4} /> : mixed ? <DashIcon /> : null}
    </button>
  )
}
