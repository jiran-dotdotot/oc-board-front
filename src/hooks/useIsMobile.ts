import { useCallback, useSyncExternalStore } from 'react'

import { MOBILE_MAX_WIDTH } from '@/utils/listLimit'

const QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`

/**
 * 모바일 여부(≤630px). 레이아웃은 CSS(min-[631px]:)로 갈리지만,
 * **동작**이 갈리는 곳(페이지네이션 vs 무한 스크롤)은 JS 값이 필요하다.
 *
 * useSyncExternalStore 를 쓰는 이유: matchMedia 는 React 밖 외부 상태라
 * useState+useEffect 로 미러링하면 구독 전 변경을 놓치고 렌더가 한 번 더 돈다.
 */
export function useIsMobile(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const mq = window.matchMedia(QUERY)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false, // SSR/프리렌더 기본값 — 데스크톱으로 본다
  )
}
