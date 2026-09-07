import { useEffect, useRef } from 'react'

import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

/* 마운트된 패널 스택. 모달이 겹칠 때 «최상위» 하나만 Tab·초점 복귀를 처리한다 —
   모든 인스턴스가 document 핸들러를 돌리면 서로 자기 패널로 초점을 되돌려 교착하고,
   그 결과 아래 패널의 버튼에 키보드로 도달할 수 없게 된다. */
const stack: HTMLElement[] = []
const isTop = (panel: HTMLElement | null) => !!panel && stack[stack.length - 1] === panel

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),iframe,video[controls],audio[controls],[tabindex]:not([tabindex="-1"])'

/** 실제로 초점을 받을 수 있는 것만. 숨은 입력(hidden 파일 선택기 등)이 섞이면
 *  트랩의 «마지막 항목»이 될 수 있고, 그것에 focus() 는 무시되므로 갇힘이 풀린다. */
function focusables(root: HTMLElement | null): HTMLElement[] {
  return [...(root?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  )
}

/* 스크림 + 배경 스크롤 잠금 + 다이얼로그 접근성.
   - role="dialog" + aria-modal: 스크린리더에 «창이 떴다»가 전달된다(WCAG 4.1.2).
   - 열 때 첫 컨트롤로 초점 이동, 닫을 때 열기 전 요소로 «반환»(WCAG 2.4.3).
   - Tab/Shift+Tab 을 패널 안에 가둔다 — 안 가두면 초점이 스크림 뒤 화면으로 새어 나가고,
     눈으로 못 보는 사용자는 자기가 창을 벗어났는지 알 수 없다.
   - ESC 는 화면마다 겹친 오버레이 순서가 달라 호출 쪽에서 처리한다.
   `label` 은 창의 접근 이름이다 — 제목이 패널 안에 있으면 `labelledBy` 로 그 id 를 넘긴다. */
export function Modal({
  onClose,
  label,
  labelledBy,
  role = 'dialog',
  scrim,
  children,
}: {
  onClose: () => void
  label?: string
  labelledBy?: string
  /** 즉시 주의를 요구하는 알림이면 'alertdialog'. */
  role?: 'dialog' | 'alertdialog'
  /** 스크림 클래스 덮어쓰기 — 이미지·영상 미리보기처럼 배경을 더 죽여야 할 때. */
  scrim?: string
  children: React.ReactNode
}) {
  useBodyScrollLock(true)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const panel = panelRef.current
    if (panel) stack.push(panel)
    return () => {
      const i = panel ? stack.indexOf(panel) : -1
      if (i >= 0) stack.splice(i, 1)
    }
  }, [])

  useEffect(() => {
    // 열기 직전 초점을 기억해 두고, 닫힐 때 그 자리로 돌려보낸다.
    const opener = document.activeElement as HTMLElement | null
    const first = focusables(panelRef.current)[0]
    // 포커스 가능한 것이 없으면 패널 자체에 준다(초점이 body 로 떨어지면 창을 못 읽는다).
    ;(first ?? panelRef.current)?.focus()
    return () => opener?.focus?.()
  }, [])

  // Tab 은 «document» 에서 잡는다. 패널의 onKeyDown 으로는 초점이 패널 밖(body)에 있을 때
  // 이벤트가 패널로 버블하지 않아 트랩이 통째로 풀린다 — 진행 중 모달처럼 패널 안 컨트롤이
  // 모두 언마운트/disabled 되면 초점이 실제로 body 로 떨어진다.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!isTop(panel) || !panel) return
      const items = focusables(panel)
      const active = document.activeElement
      // 포커스 갈 곳이 하나도 없으면 패널 자신에 붙들어 둔다(밖으로 새면 aria-modal 로 가려진
      // 영역에 초점이 놓여 스크린리더가 읽을 수 없는 상태가 된다).
      if (items.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (!panel.contains(active)) {
        e.preventDefault()
        ;(e.shiftKey ? lastEl : firstEl).focus()
      } else if (e.shiftKey && active === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // 패널 안 컨트롤이 사라져 초점이 body 로 떨어지면(업로드 시작 등) 패널로 되돌린다.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const observer = new MutationObserver(() => {
      // 최상위가 아니면 초점을 건드리지 않는다(위 모달의 조작을 방해한다).
      if (!isTop(panel)) return
      if (!panel.contains(document.activeElement)) {
        ;(focusables(panel)[0] ?? panel).focus()
      }
    })
    observer.observe(panel, { childList: true, subtree: true, attributes: true })
    return () => observer.disconnect()
  }, [])

  return (
    <div
      className={`fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 ${scrim ?? 'bg-[var(--scrim-modal)]'}`}
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="outline-none"
      >
        {children}
      </div>
    </div>
  )
}
