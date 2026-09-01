import type { ToastTone } from '@/components/common/useToast'

// 토스트 자동 닫힘 시간(ms). 디자인 「컴포넌트 갤러리 4」 확정(#1):
// 성공·정보 3초, **에러 5초**(읽을 시간이 더 필요하다).
export const TOAST_MS: Record<ToastTone, number> = {
  success: 3000,
  warning: 3000,
  error: 5000,
}
