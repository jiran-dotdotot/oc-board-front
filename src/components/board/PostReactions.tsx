import { useTranslation } from 'react-i18next'

import { ReactionPicker } from './ReactionPicker'
import { REACTION_PINNED } from './constants'
import { ChevronIcon } from '@/components/common/icons'
import type { PostLikeStat } from '@/types/post'

/**
 * 공감 칩 줄. 정본 `dReactChips`(개선안 통합 앱.dc.html:551-555) 그대로.
 *
 * 칩은 **서버 집계**(`post.likes`)를 그린다 — 반응이 1건 이상인 이모지만 온다.
 * 따라서 «새로 누를» 이모지는 「+」 팝오버(ReactionPicker)의 고정 세트에서 고른다.
 * 세트 밖 이모지로 달린 기존 반응도 칩으로는 그대로 보인다.
 *
 * 상태를 색만으로 전하지 않는다 — `aria-pressed` 로 켜짐/꺼짐을 읽어 준다(WCAG 1.4.1/4.1.2).
 */
export function PostReactions({
  likes,
  onToggle,
  onHistory,
  busy,
}: {
  likes: PostLikeStat[]
  onToggle: (emoji: string) => void
  onHistory: () => void
  busy: boolean
}) {
  const { t } = useTranslation()

  // 정본은 «고정 4칩»을 항상 그린다(반응 0건이어도). 서버 집계엔 0 카운트가 없으므로
  // 고정 세트를 먼저 깔고 그 위에 서버 값을 얹은 뒤, 세트 밖 이모지를 뒤에 이어 붙인다.
  const byEmoji = new Map(likes.map((l) => [l.emoji, l]))
  const shown: PostLikeStat[] = [
    ...REACTION_PINNED.map((e) => byEmoji.get(e) ?? { emoji: e, count: 0, is_reacted: 0 }),
    ...likes.filter((l) => !REACTION_PINNED.includes(l.emoji as (typeof REACTION_PINNED)[number])),
  ]

  // busy 는 aria-busy 로만 알린다. disabled 로 끄면 «초점을 쥔» 칩이 비활성되어 브라우저가
  // 초점을 body 로 되돌린다 — 키보드 사용자가 매번 처음부터 Tab 해야 한다. 중복 요청 가드는 호출부에 있다.
  return (
    <div aria-busy={busy} className="flex flex-wrap items-center gap-[7px] pt-1.5">
      {shown.map((l) => {
        const on = !!l.is_reacted
        return (
          <button
            key={l.emoji}
            type="button"
            onClick={() => onToggle(l.emoji)}
            aria-pressed={on}
            aria-label={t(on ? 'detail-react-on' : 'detail-react-off', { emoji: l.emoji })}
            // 정본: 모바일 h38 → 데스크톱 h36
            className={`inline-flex h-[38px] items-center gap-1.5 rounded-full border px-[13px] text-s font-semibold hover:border-primary min-[631px]:h-9 ${
              on
                ? 'border-primary bg-ov-blue-50 text-primary'
                : 'border-gray-200 bg-card text-gray-600'
            }`}
          >
            <span className="text-base leading-none">{l.emoji}</span>
            {l.count}
          </button>
        )
      })}

      <ReactionPicker likes={likes} onPick={onToggle} />

      <button
        type="button"
        onClick={onHistory}
        className="ml-auto inline-flex items-center gap-[3px] text-s text-gray-500 hover:text-primary"
      >
        {t('detail-view-likers')}
        <ChevronIcon className="size-3" dir="right" small />
      </button>
    </div>
  )
}
