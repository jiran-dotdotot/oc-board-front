import { useTranslation } from 'react-i18next'

import { Modal } from '@/components/common/Modal'

/**
 * 파괴적 동작 확인 모달. 게시글 상세·자료실·마이페이지가 **함께 쓴다** — 개별 화면에 복사하지 말 것.
 *
 * 정본에 두 변형이 있다:
 *  - 아이콘 없음 · 320 (`cf*`, 글/댓글 삭제 — 개선안 통합 앱)
 *  - 아이콘 원 · 330 (휴지통 영구삭제·자료 삭제 — 화면 08 마이페이지 / 화면 07 자료실)
 * `icon` 유무가 폭을 결정하므로 별도 prop 을 두지 않는다.
 */
export function ConfirmModal({
  title,
  sub,
  confirmLabel,
  cancelLabel,
  icon,
  compact,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string
  sub?: React.ReactNode
  confirmLabel: string
  /** 「취소」가 아닌 문구가 필요할 때 — 다운로드 취소 확인은 「계속 받기」다. */
  cancelLabel?: string
  /** 제목 위 원형 아이콘. 있으면 330 폭 변형이 된다. */
  icon?: React.ReactNode
  /** 정본 dl* 취소 확인은 버튼이 h38 · 13/600 이다(cf* 는 h40 · 14/600). */
  compact?: boolean
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const btn = compact ? 'h-[38px] text-s' : 'h-10 text-sm'
  return (
    <Modal onClose={onCancel} label={title} role="alertdialog">
      <div
        className={`flex max-w-full flex-col items-center gap-2 rounded-md bg-card px-[22px] pt-[26px] pb-[18px] shadow-[var(--shadow-modal)] ${icon ? 'w-[330px]' : 'w-80'}`}
      >
        {icon && (
          <span className="inline-flex size-[42px] items-center justify-center rounded-full bg-destructive-bg text-destructive">
            {icon}
          </span>
        )}
        <span className={`text-center text-sm font-semibold text-gray-900 ${icon ? 'mt-1' : ''}`}>
          {title}
        </span>
        {sub && <span className="text-center text-s text-gray-500">{sub}</span>}
        <div className="mt-2.5 flex w-full gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={`inline-flex flex-1 items-center justify-center rounded-md border border-gray-200 bg-card font-semibold text-gray-800 hover:bg-gray-100 ${btn}`}
          >
            {cancelLabel ?? t('common-cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex flex-1 items-center justify-center rounded-md bg-destructive font-semibold text-white hover:bg-destructive-hover disabled:opacity-60 ${btn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
