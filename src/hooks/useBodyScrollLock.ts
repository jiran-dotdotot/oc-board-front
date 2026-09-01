import { useEffect } from 'react'

// 열려 있는 오버레이 수. 모달 위에 모달이 겹칠 때 «마지막 하나»가 닫힐 때만 풀어야 한다
// — 각자 해제하면 위 모달이 닫히는 순간 아래 모달이 떠 있는데도 배경이 다시 스크롤된다.
// (디자인 「컴포넌트 갤러리 4」 구현 노트 #2)
let openCount = 0
let restore = ''

/**
 * 오버레이가 떠 있는 동안 배경(body) 스크롤을 잠근다. `active` 가 true 인 동안만.
 *
 * ⚠ 스크롤바 폭 보정을 함께 한다. overflow:hidden 만 걸면 스크롤바가 사라지면서
 *   배경이 그 폭만큼 옆으로 튄다 — 모달을 열 때마다 화면이 흔들린다.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    if (openCount === 0) {
      restore = document.body.style.overflow
      const gap = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      if (gap > 0) document.body.style.paddingRight = `${gap}px`
    }
    openCount += 1
    return () => {
      openCount -= 1
      if (openCount === 0) {
        document.body.style.overflow = restore
        document.body.style.paddingRight = ''
      }
    }
  }, [active])
}
