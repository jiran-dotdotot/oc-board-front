import { useCallback, useEffect, useRef, useState } from 'react'

import { TOAST_MS } from '@/components/common/constants'

export type ToastTone = 'success' | 'warning' | 'error'

export interface ToastState {
  message: string
  tone: ToastTone
}

/**
 * 토스트 상태 + 자동 닫힘 타이머.
 * 디자인 「컴포넌트 갤러리 4」 확정(#1): 하단 중앙 · 성공/정보 3초 · **에러 5초** ·
 * 스택 없이 **1개 교체**(새 토스트가 뜨면 이전 것을 즉시 대체).
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const hideToast = useCallback(() => {
    window.clearTimeout(timer.current)
    setToast(null)
  }, [])

  // 1개 교체 규약: 이전 타이머를 끄고 새로 건다. 안 끄면 먼저 뜬 토스트의 타이머가
  // 나중 토스트를 조기에 닫아 버린다.
  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    window.clearTimeout(timer.current)
    setToast({ message, tone })
    timer.current = window.setTimeout(() => setToast(null), TOAST_MS[tone])
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return { toast, showToast, hideToast }
}
