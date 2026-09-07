import type { ToastTone } from '@/components/common/useToast'

// 토스트 자동 닫힘 시간(ms). 디자인 「컴포넌트 갤러리 4」 확정(#1):
// 성공·정보 3초, **에러 5초**(읽을 시간이 더 필요하다).
export const TOAST_MS: Record<ToastTone, number> = {
  success: 3000,
  warning: 3000,
  error: 5000,
}

// 섹션/화면 제목 옆 NEW 배지. 색은 호출부가 정한다 —
// 게시글=bg-success(디자인 accent 초록), 자료=bg-primary.
// ⚠ shadcn 의 `accent` 는 «연한 배경» 이라 초록이 아니다. success 를 쓴다.
export const NEW_BADGE =
  'inline-flex h-[22px] flex-none items-center justify-center rounded-md px-[9px] text-[11px] font-extrabold tracking-[0.02em] text-white'
