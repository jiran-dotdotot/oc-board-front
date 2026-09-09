import { useEffect, useRef, useState } from 'react'

import { useTranslation } from 'react-i18next'

import { REACTION_EMOJIS } from './constants'
import { PlusIcon } from '@/components/common/icons'
import type { PostLikeStat } from '@/types/post'

/**
 * 「+」 → 고정 이모지 세트 팝오버. **게시글 공감과 댓글 공감이 같은 것을 쓴다** —
 * 서버 집계(`likes`)엔 «반응이 1건 이상인» 이모지만 오므로 새로 누를 이모지는 여기서 고른다.
 *
 * 팝오버는 모달이 아니다(배경을 잠그지 않는다) — ESC · 바깥 클릭 · 초점 이탈로 닫는다.
 *
 * ⚠ ESC 를 «가로채지» 않는다. 예전엔 document 의 capture 단계에서 stopPropagation 했는데,
 *   팝오버가 열린 채 Tab 으로 뒤 버튼에 가서 모달을 열면 그 모달의 ESC 까지 삼키고 초점을
 *   스크림에 가려진 「+」 로 끌어갔다(오버레이는 aria-hidden/tabIndex=-1 이라 Tab 을 막지 않는다).
 *   대신 초점이 벗어나면 닫으므로 그 상황 자체가 생기지 않는다.
 */
export function ReactionPicker({
  likes,
  onPick,
  size = 'md',
}: {
  likes: PostLikeStat[]
  onPick: (emoji: string) => void
  /** 댓글 행은 글자가 12px 이라 트리거를 작게 쓴다. */
  size?: 'md' | 'sm'
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const reacted = new Set(likes.filter((l) => l.is_reacted).map((l) => l.emoji))
  // sm 은 아이콘이 12px 이라 그대로 두면 터치 대상이 12×12 다 — 음수 마진으로 «레이아웃은
  // 그대로» 두고 패딩으로 히트 영역만 24×24 로 넓힌다(WCAG 2.5.8 Target Size Minimum).
  const trigger =
    size === 'sm'
      ? '-m-1.5 inline-flex items-center justify-center rounded-md p-1.5 text-gray-400 hover:text-primary'
      : 'inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-gray-300 bg-card px-3 text-s font-semibold text-gray-500 hover:border-primary hover:text-primary'

  return (
    <div
      className="relative flex-none"
      onBlur={(e) => {
        // 초점이 팝오버 밖으로 나가면 닫는다 — 열린 채 남아 다른 컨트롤과 겹치지 않게.
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
        aria-label={t('detail-react-add')}
        className={trigger}
      >
        <PlusIcon className={size === 'sm' ? 'size-3' : 'size-3.5'} />
      </button>
      {open && (
        <>
          {/* 바깥 클릭 감지용 — 초점 대상이 되지 않도록 접근성 트리에서 뺀다(Dropdown 과 같은 방식) */}
          <div
            aria-hidden="true"
            tabIndex={-1}
            role="presentation"
            className="fixed inset-0 z-[var(--z-dropdown)] cursor-default"
            onMouseDown={() => setOpen(false)}
          />
          <div className="absolute bottom-[calc(100%+6px)] left-0 z-[var(--z-dropdown)] flex gap-1 rounded-lg border border-gray-200 bg-card p-1.5 shadow-[var(--shadow-dropdown)]">
            {REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={reacted.has(e)}
                aria-label={t(reacted.has(e) ? 'detail-react-on' : 'detail-react-off', {
                  emoji: e,
                })}
                onClick={() => {
                  onPick(e)
                  setOpen(false)
                  triggerRef.current?.focus()
                }}
                className={`inline-flex size-9 items-center justify-center rounded-md text-lg hover:bg-gray-100 ${
                  reacted.has(e) ? 'bg-ov-blue-50' : ''
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
