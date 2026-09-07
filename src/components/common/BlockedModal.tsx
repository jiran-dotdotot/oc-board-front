import { useEffect } from 'react'

import { useTranslation } from 'react-i18next'

import { Modal } from '@/components/common/Modal'

/* 「이 화면에 머물 이유가 없다」를 알리고 나가는 알림 (삭제됨 404 · 권한 없음 403).
   자동 리다이렉트만 하면 왜 튕겼는지 알 수 없어, 확인 버튼으로 막고 나서 이동한다.
   스크림·초점 이동·포커스 트랩·초점 반환은 공용 Modal 이 담당한다 — 직접 구현하면
   aria-modal 만 선언하고 트랩이 없는 상태가 된다. */
export function BlockedModal({ message, onClose }: { message: string; onClose: () => void }) {
  const { t } = useTranslation()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <Modal onClose={onClose} label={message} role="alertdialog">
      <div className="flex w-[320px] max-w-full flex-col items-center gap-[18px] rounded-lg bg-card px-[22px] pt-[26px] pb-[18px] shadow-[var(--shadow-modal)]">
        <span className="text-center text-sm font-semibold text-gray-900">{message}</span>
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-full rounded-md bg-primary text-sm font-semibold text-white hover:bg-ov-blue-700"
        >
          {t('common-confirm')}
        </button>
      </div>
    </Modal>
  )
}
