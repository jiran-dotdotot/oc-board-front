import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

import { useTranslation } from 'react-i18next'

import { NAMO_EDITOR_HEIGHT, NAMO_EDITOR_TIMEOUT_MS, NAMO_EDITOR_URL } from './constants'
import { useIsMobile } from '@/hooks/useIsMobile'

/**
 * 나모 CrossEditor iframe(레거시 AddPostView.vue:443-475·:947-951 의 프로토콜을 그대로 쓴다).
 *
 * 앱 → 에디터: `'saveEditor'`(임시 이미지를 실데이터로 바꾼 뒤 HTML 반환 — 저장 시 반드시 이것),
 *              `{title:'setNamoEditorBody', value}`(프리필)
 * 에디터 → 앱: `{title:'onInitCompleted'}` · `{title:'saveEditor', value}` · `{title:'getNamoEditorBody', value}`
 *
 * 레거시와 다른 점: 무응답이면 25초 뒤 «예전 본문»을 저장했다(:428-441). 여기선 15초 뒤 reject 해
 * 저장을 멈춘다 — 조용한 데이터 손실 금지(⚠️ 가정 A6).
 * 에디터가 만든 HTML 은 그대로 신뢰하지 않는다 — 호출부가 `sanitizePostHtml` 을 거친다(Go 는 살균하지 않음, 06:39).
 */
export interface NamoEditorHandle {
  /** 저장용 본문. 에디터가 응답하지 않으면 reject 한다. */
  getHtml(): Promise<string>
}

const ORIGIN = new URL(NAMO_EDITOR_URL).origin

export const NamoEditor = forwardRef<
  NamoEditorHandle,
  { initialHtml?: string; onTouch?: () => void }
>(function NamoEditor({ initialHtml, onTouch }, ref) {
    const { i18n, t } = useTranslation()
    const isMobile = useIsMobile()
    const frame = useRef<HTMLIFrameElement>(null)
    const [ready, setReady] = useState(false)
    // 대기 중인 getHtml() 의 resolve — 한 번에 하나만 있다.
    const pending = useRef<{ resolve: (h: string) => void; timer: number } | null>(null)
    // 마운트 시각을 캐시 무효화 파라미터로 — 레거시 `time=` 과 같다. 언어를 바꿔도 iframe 을 다시 만들지 않는다.
    const [src] = useState(
      () => `${NAMO_EDITOR_URL}?lang=${i18n.language}&mobile=${isMobile}&time=${Date.now()}`,
    )

    useEffect(() => {
      const onMessage = (e: MessageEvent) => {
        if (e.origin !== ORIGIN || e.source !== frame.current?.contentWindow) return
        const d = e.data as { title?: string; value?: string } | undefined
        if (d?.title === 'onInitCompleted') setReady(true)
        if ((d?.title === 'saveEditor' || d?.title === 'getNamoEditorBody') && pending.current) {
          window.clearTimeout(pending.current.timer)
          pending.current.resolve(d.value ?? '')
          pending.current = null
        }
      }
      window.addEventListener('message', onMessage)
      return () => window.removeEventListener('message', onMessage)
    }, [])

    // 프리필은 데이터와 에디터 init 이 «둘 다» 준비된 뒤 한 번(레거시 :448).
    const seeded = useRef(false)
    useEffect(() => {
      if (!ready || seeded.current || initialHtml == null) return
      seeded.current = true
      frame.current?.contentWindow?.postMessage(
        { title: 'setNamoEditorBody', value: initialHtml },
        ORIGIN,
      )
    }, [ready, initialHtml])

    // 에디터 안의 입력은 iframe 밖에서 볼 수 없다 — 초점이 iframe 으로 넘어간 순간을 「손댔다」로 본다
  // (창 blur 시 activeElement 가 iframe). 이탈 확인의 dirty 판정에만 쓴다.
  useEffect(() => {
    if (!onTouch) return
    const onBlur = () => {
      if (document.activeElement === frame.current) onTouch()
    }
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [onTouch])

  useImperativeHandle(ref, () => ({
      getHtml: () =>
        new Promise<string>((resolve, reject) => {
          const win = frame.current?.contentWindow
          if (!win) return reject(new Error('EDITOR_UNAVAILABLE'))
          const timer = window.setTimeout(() => {
            pending.current = null
            reject(new Error('EDITOR_TIMEOUT'))
          }, NAMO_EDITOR_TIMEOUT_MS)
          pending.current = { resolve, timer }
          win.postMessage('saveEditor', ORIGIN)
        }),
    }))

    return (
      <iframe
        ref={frame}
        src={src}
        title={t('write-body-ph')}
        height={isMobile ? NAMO_EDITOR_HEIGHT.mobile : NAMO_EDITOR_HEIGHT.desktop}
        sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"
        className="w-full rounded-b-md border border-t-0 border-gray-200 bg-white"
      />
    )
  },
)
