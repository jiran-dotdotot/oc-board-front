import { useEffect, useId, useState } from 'react'

import { useTranslation } from 'react-i18next'

import { OrgPicker } from './OrgPicker'
import { Modal } from '@/components/common/Modal'
import { XMini } from '@/components/common/icons'
import type { OrgSelection } from '@/types/department'
import type { OrgMode } from '@/utils/orgTree'

/**
 * 상세 패널이 여는 조직도 모달(정본 화면 09 L441-487 — 720px · 좌 1fr / 우 270px).
 * 선택은 **모달 안에서만** 바뀌고 「확인」에서 한 번에 올라간다 — 취소하면 아무것도 안 보낸다.
 * ESC 는 `Modal` 이 아니라 호출부 몫이라 여기서 처리한다.
 */
export function OrgPickerModal({
  mode,
  categoryId,
  initial,
  onClose,
  onConfirm,
}: {
  mode: OrgMode
  categoryId: string | null
  initial: OrgSelection
  onClose: () => void
  onConfirm: (next: OrgSelection) => void
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const [value, setValue] = useState<OrgSelection>(initial)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <Modal onClose={onClose} labelledBy={titleId}>
      <div className="flex max-h-[calc(100dvh-2rem)] w-[720px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg bg-card shadow-[var(--shadow-modal)]">
        <div className="flex items-center gap-2.5 border-b border-gray-100 px-5 pt-4 pb-3">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span id={titleId} className="text-base font-bold">
              {t(mode === 'admin' ? 'admin-org-title-admin' : 'admin-org-title-scope')}
            </span>
            <span className="text-xs text-gray-400">
              {t(mode === 'admin' ? 'admin-org-hint-admin' : 'admin-org-hint-scope')}
            </span>
          </span>
          <button
            type="button"
            aria-label={t('common-cancel')}
            onClick={onClose}
            className="ml-auto inline-flex size-7 flex-none items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <XMini size={14} />
          </button>
        </div>

        <OrgPicker mode={mode} categoryId={categoryId} value={value} onChange={setValue} />

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-md border border-gray-200 bg-card px-4 text-sm font-semibold text-gray-800 hover:bg-gray-100"
          >
            {t('common-cancel')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(value)}
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-ov-blue-700"
          >
            {t('common-confirm')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
