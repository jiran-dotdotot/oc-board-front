import { CheckIcon, ChevronDownIcon } from '@/components/common/icons'

/* 목록 컨트롤 드롭다운 (정렬 · 개수). 자료실·게시글 목록이 함께 쓴다.
   바깥 클릭으로 닫기: 화면 전체를 덮는 투명 버튼 하나로 처리한다. */
export function Dropdown({
  label,
  open,
  onToggle,
  onClose,
  width,
  options,
}: {
  label: string
  open: boolean
  onToggle: () => void
  onClose: () => void
  width: string
  options: { key: string; label: string; selected: boolean; onPick: () => void }[]
}) {
  return (
    <div className="relative flex-none">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-card px-3 text-s whitespace-nowrap text-gray-700 hover:bg-gray-100"
      >
        {label}
        <ChevronDownIcon className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <>
          {/* 바깥 클릭 감지용 오버레이. 초점 대상이 되면 Tab 이 «보이지 않는 버튼»에 멈추므로
              tabIndex=-1 + aria-hidden 으로 접근성 트리에서 뺀다. mousedown 에서 닫아
              그 아래 컨트롤의 click 이 살아 있게 한다(인접 토글을 한 번에 열 수 있다). */}
          <div
            aria-hidden="true"
            tabIndex={-1}
            role="presentation"
            className="fixed inset-0 z-[var(--z-dropdown)] cursor-default"
            onMouseDown={onClose}
          />
          <div
            className={`absolute top-[calc(100%+4px)] right-0 z-[var(--z-dropdown)] ${width} rounded-lg border border-gray-200 bg-card p-1 shadow-[var(--shadow-dropdown)]`}
          >
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => {
                  o.onPick()
                  onClose()
                }}
                aria-current={o.selected ? 'true' : undefined}
                className={`flex h-8 w-full items-center gap-1.5 rounded-md px-2.5 text-s hover:bg-gray-100 ${o.selected ? 'font-semibold text-primary' : 'text-gray-800'}`}
              >
                {o.label}
                {/* 선택 표시는 색·굵기만이 아니라 «형태»로도 준다(정본 so.on 체크) — 색 대비 하나에 의존하지 않기 */}
                {o.selected && <CheckIcon className="ml-auto size-3" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
