import { useCallback, useEffect, useRef, useState } from 'react'

// 바닥에 닿기 전에 미리 불러온다 — 레거시 useMainScroll 의 +100px 선발화와 같은 값.
const PRELOAD_MARGIN = '100px'

/**
 * 목록 끝 감시자. 반환한 ref 를 마지막 요소 뒤 센티널에 걸면, 화면에 들어오기
 * 100px 전에 `onHit` 을 부른다.
 *
 * 스크롤 수치 계산(scrollTop + clientHeight > scrollHeight) 대신 IntersectionObserver 를
 * 쓰는 이유: 우리 앱은 **모바일에선 문서가, 데스크톱에선 <main> 이** 스크롤한다.
 * 수치 계산은 어느 요소가 스크롤하는지 알아야 하지만, 관찰자는 뷰포트 기준이라 그럴 필요가 없다.
 */
export function useInfiniteScroll(onHit: () => void, enabled: boolean) {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  const latest = useRef(onHit)

  // 렌더 중이 아니라 커밋 후에 갱신한다 — onHit 이 매 렌더 새 함수여도 관찰자는 유지된다.
  useEffect(() => {
    latest.current = onHit
  }, [onHit])

  useEffect(() => {
    if (!enabled || !node) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) latest.current()
      },
      { rootMargin: PRELOAD_MARGIN },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [enabled, node])

  return useCallback((el: HTMLDivElement | null) => setNode(el), [])
}
