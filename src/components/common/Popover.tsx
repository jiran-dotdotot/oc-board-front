import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 트리거 + 떠 있는 패널. 댓글 ⋮ 메뉴와 공감 이모지 피커가 «같은 껍데기»를 쓴다.
 *
 * 팝오버는 모달이 아니다(배경을 잠그지 않는다) — ESC · 바깥 클릭 · 초점 이탈로 닫고
 * 닫을 때 초점을 트리거로 돌려준다(WCAG 2.4.3).
 *
 * ⚠ ESC 를 «가로채지» 않는다. 예전엔 capture 단계에서 stopPropagation 했는데, 팝오버가 열린 채
 *   Tab 으로 뒤 버튼에 가서 모달을 열면 그 모달의 ESC 까지 삼켰다. 대신 초점이 벗어나면 닫는다.
 *
 * ⚠ 패널 안 항목이 «자기 자신을 언마운트»하는 동작(모달 열기·편집 시작)을 하기 전에 close() 를
 *   부르면 초점이 트리거로 돌아간 뒤 동작이 실행된다 — 이 순서가 아니면 뒤이어 열리는 모달이
 *   기억하는 opener 가 document.body 가 되고, 닫을 때 초점이 문서 맨 앞으로 튄다.
 */
export function Popover({
  label,
  triggerClass,
  panelClass,
  trigger,
  btnRef,
  children,
}: {
  /** 트리거의 접근 이름. */
  label: string
  triggerClass: string
  /** 패널의 위치·크기·모양. 공통 껍데기(테두리·배경·그림자)는 여기서 붙인다. */
  panelClass: string
  trigger: React.ReactNode
  /** 팝오버가 닫힌 «뒤»에도 초점을 돌려받아야 하는 호출부(편집창 취소 등)가 트리거를 잡아 둔다. */
  btnRef?: React.RefObject<HTMLButtonElement | null>
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ownRef = useRef<HTMLButtonElement | null>(null)
  const triggerRef = btnRef ?? ownRef
  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [triggerRef])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  return (
    <div
      className="relative flex-none"
      onBlur={(e) => {
        if (!open) return
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setOpen(false)
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label}
        className={triggerClass}
      >
        {trigger}
      </button>
      {open && (
        <>
          {/* 바깥 클릭 감지용 오버레이. 초점 대상이 되면 Tab 이 «보이지 않는 버튼»에 멈추므로
              tabIndex=-1 + aria-hidden 으로 접근성 트리에서 뺀다. mousedown 에서 닫아
              그 아래 컨트롤의 click 이 살아 있게 한다. */}
          <div
            aria-hidden="true"
            tabIndex={-1}
            role="presentation"
            className="fixed inset-0 z-[var(--z-dropdown)] cursor-default"
            onMouseDown={() => setOpen(false)}
          />
          <div
            className={`absolute z-[var(--z-dropdown)] rounded-lg border border-gray-200 bg-card shadow-[var(--shadow-dropdown)] ${panelClass}`}
          >
            {/* close 는 렌더 중 ref 를 읽지 않는다 — 패널 항목의 onClick 안에서만 불린다.
                린트 규칙은 «전달» 시점을 렌더로 보므로 여기서만 끈다. */}
            {/* eslint-disable-next-line react-hooks/refs */}
            {children(close)}
          </div>
        </>
      )}
    </div>
  )
}
