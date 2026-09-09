import { useTranslation } from 'react-i18next'

import { REACTION_EMOJIS } from './constants'
import { Popover } from '@/components/common/Popover'
import { PlusIcon } from '@/components/common/icons'
import type { PostLikeStat } from '@/types/post'

/**
 * 「+」 → 고정 이모지 세트 팝오버. **게시글 공감과 댓글 공감이 같은 것을 쓴다** —
 * 서버 집계(`likes`)엔 «반응이 1건 이상인» 이모지만 오므로 새로 누를 이모지는 여기서 고른다.
 * 열고 닫는 규약은 공용 Popover 가 갖는다.
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
  const reacted = new Set(likes.filter((l) => l.is_reacted).map((l) => l.emoji))
  // sm 은 아이콘이 12px 이라 그대로 두면 터치 대상이 12×12 다 — 음수 마진으로 «레이아웃은
  // 그대로» 두고 패딩으로 히트 영역만 24×24 로 넓힌다(WCAG 2.5.8 Target Size Minimum).
  const trigger =
    size === 'sm'
      ? '-m-1.5 inline-flex items-center justify-center rounded-md p-1.5 text-gray-400 hover:text-primary'
      : 'inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-gray-300 bg-card px-3 text-s font-semibold text-gray-500 hover:border-primary hover:text-primary'

  return (
    <Popover
      label={t('detail-react-add')}
      triggerClass={trigger}
      trigger={<PlusIcon className={size === 'sm' ? 'size-3' : 'size-3.5'} />}
      panelClass="bottom-[calc(100%+6px)] left-0 flex gap-1 p-1.5"
    >
      {(close) =>
        REACTION_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            aria-pressed={reacted.has(e)}
            aria-label={t(reacted.has(e) ? 'detail-react-on' : 'detail-react-off', { emoji: e })}
            onClick={() => {
              onPick(e)
              close()
            }}
            // 선택 hover 는 ov-blue-100 이다 — hover:bg-gray-100 을 무조건 붙이면
            // 명시도(0,2,0 > 0,1,0)로 선택 배경을 덮어 「이미 반응함」이 보이지 않는다.
            className={`inline-flex size-9 items-center justify-center rounded-md text-lg ${
              reacted.has(e) ? 'bg-ov-blue-50 hover:bg-ov-blue-100' : 'hover:bg-gray-100'
            }`}
          >
            {e}
          </button>
        ))
      }
    </Popover>
  )
}
