import { useTranslation } from 'react-i18next'

import type { ToastState, ToastTone } from '@/components/common/useToast'

const TONE_ICON: Record<ToastTone, string> = {
  success: 'text-accent',
  warning: 'text-warning',
  error: 'text-destructive',
}

/**
 * 하단 중앙 토스트. 화면마다 복제돼 있던 다섯 벌을 하나로 합쳤다
 * (CLAUDE.md UI verb-unification).
 */
export function Toast({ toast, onClose }: { toast: ToastState | null; onClose: () => void }) {
  const { t } = useTranslation()
  if (!toast) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[18px] left-1/2 z-[var(--z-toast)] flex h-[46px] max-w-[92%] -translate-x-1/2 animate-in items-center gap-2.5 rounded-lg bg-gray-900 py-0 pr-2.5 pl-3.5 text-gray-50 shadow-[var(--shadow-modal)] duration-100 fade-in slide-in-from-bottom-2 motion-reduce:animate-none"
    >
      <ToneIcon className={`size-4 flex-none ${TONE_ICON[toast.tone]}`} tone={toast.tone} />
      <span className="truncate text-[13px] font-medium">{toast.message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('common-close')}
        className="inline-flex size-[26px] flex-none items-center justify-center rounded-[5px] opacity-70 hover:opacity-100"
      >
        <svg
          className="size-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}

function ToneIcon({ tone, className }: { tone: ToastTone; className: string }) {
  if (tone === 'warning') {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3.5L21.5 20h-19L12 3.5z" />
        <path d="M12 10v4M12 17h.01" />
      </svg>
    )
  }
  if (tone === 'error') {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5V13M12 16.5h.01" />
      </svg>
    )
  }
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  )
}
