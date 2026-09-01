import { useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import {
  CheckIcon,
  ClearIcon,
  ErrorIcon,
  EyeIcon,
  LockIcon,
  MailIcon,
} from '@/components/common/icons'
import { useLogin } from '@/hooks/useLogin'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

// 화면 노트(§7-B): 이메일/비밀번호 "형식 검증 없음" — 필수(빈값)만 인라인 검증.
const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
})

type LoginValues = z.infer<typeof loginSchema>

const BRAND_LINES = ['login-brand-1', 'login-brand-2', 'login-brand-3'] as const
const BRAND_BULLETS = [
  'login-brand-bullet-1',
  'login-brand-bullet-2',
  'login-brand-bullet-3',
] as const

// 테두리 상태: 기본 gray-300 → 값 입력 시 primary → 오류 시 danger (화면 노트)
function fieldBorder(value: string, hasError: boolean) {
  if (hasError) return 'border-destructive'
  return value ? 'border-primary' : 'border-gray-300'
}

export function LoginScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(true)
  const loginMutation = useLogin()
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const email = useWatch({ control, name: 'email' })
  const password = useWatch({ control, name: 'password' })

  // 실제 로그인: POST /login → 성공 시 토큰 저장(authService) 후 홈 이동, 실패 시 에러 표시.
  const onSubmit = (values: LoginValues) => {
    if (loginMutation.isPending) return
    loginMutation.mutate(
      { username: values.email, password: values.password },
      {
        onSuccess: () => {
          // 이전 사용자 정보 캐시 제거 → 새 세션에서 /me 새로 조회
          queryClient.removeQueries({ queryKey: ['me'] })
          navigate({ to: '/' })
        },
      },
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 min-[631px]:p-6">
      <div className="flex w-full max-w-[420px] flex-col overflow-hidden rounded-xl bg-card shadow-[var(--shadow-modal)] min-[631px]:max-w-[860px] min-[631px]:flex-row">
        {/* ── 브랜드 패널 (좌 / 모바일은 상단 배너) ── */}
        <div className="relative overflow-hidden bg-brand-panel px-5 pt-[34px] pb-[30px] text-white min-[631px]:w-[344px] min-[631px]:flex-none min-[631px]:px-[34px] min-[631px]:py-[42px]">
          <div className="relative z-[1] flex items-center gap-2.5">
            <span className="inline-flex size-[34px] flex-none items-center justify-center rounded-md bg-white/15">
              <WaveMark />
            </span>
            <span className="text-xl tracking-title">
              <span className="font-medium opacity-80">Office</span>
              <span className="font-extrabold">NEXT</span>
            </span>
          </div>
          <div className="relative z-[1] mt-3 flex flex-col text-lg leading-title font-extrabold tracking-display min-[631px]:mt-[30px] min-[631px]:text-2xl min-[631px]:leading-title">
            {BRAND_LINES.map((k) => (
              <span key={k}>{t(k)}</span>
            ))}
          </div>
          <div className="relative z-[1] mt-[26px] hidden flex-col gap-3 min-[631px]:flex">
            {BRAND_BULLETS.map((k) => (
              <span key={k} className="flex items-center gap-2.5 text-sm text-white/90">
                <CheckIcon className="size-4 flex-none opacity-85" />
                {t(k)}
              </span>
            ))}
          </div>
          <WaveDecoration />
        </div>

        {/* ── 폼 패널 (우 / 모바일은 겹치는 하단 카드) ── */}
        <div className="relative z-[1] -mt-4 flex flex-1 flex-col rounded-t-xl bg-card px-5 pt-6 pb-[30px] min-[631px]:mt-0 min-[631px]:rounded-none min-[631px]:px-[42px] min-[631px]:pt-[44px] min-[631px]:pb-[30px]">
          <span className="text-lg font-extrabold tracking-display text-gray-900 min-[631px]:text-2xl">
            {t('login-title')}
          </span>
          <span className="mt-[7px] hidden text-sm text-gray-500 min-[631px]:block">
            {t('login-subtitle')}
          </span>

          <form
            noValidate
            onSubmit={handleSubmit(onSubmit)}
            className="mt-5 flex flex-col min-[631px]:mt-[26px]"
          >
            <div className="flex flex-col gap-4">
              {/* 이메일 */}
              <div className="flex flex-col gap-[7px]">
                <label htmlFor="login-email" className="text-s font-semibold text-gray-600">
                  {t('login-email-label')}
                </label>
                <div
                  className={`flex h-12 items-center gap-2.5 rounded-md border bg-card px-3.5 transition-colors ${fieldBorder(email, !!errors.email)}`}
                >
                  <MailIcon />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={!!errors.email}
                    placeholder={t('login-email-placeholder')}
                    className="min-w-0 flex-1 border-none bg-transparent text-sm text-gray-900 outline-none"
                    {...register('email')}
                  />
                  {email && (
                    <button
                      type="button"
                      aria-label={t('login-clear-email')}
                      onClick={() => setValue('email', '', { shouldValidate: false })}
                      className="inline-flex size-[22px] flex-none items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
                    >
                      <ClearIcon />
                    </button>
                  )}
                </div>
                <FieldError show={!!errors.email}>{t('login-email-error')}</FieldError>
              </div>

              {/* 비밀번호 */}
              <div className="flex flex-col gap-[7px]">
                <label htmlFor="login-password" className="text-s font-semibold text-gray-600">
                  {t('login-password-label')}
                </label>
                <div
                  className={`flex h-12 items-center gap-2.5 rounded-md border bg-card px-3.5 transition-colors ${fieldBorder(password, !!errors.password)}`}
                >
                  <LockIcon />
                  <input
                    id="login-password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    aria-invalid={!!errors.password}
                    placeholder={t('login-password-placeholder')}
                    className="min-w-0 flex-1 border-none bg-transparent text-sm text-gray-900 outline-none"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    aria-label={t('login-toggle-password')}
                    onClick={() => setShowPw((v) => !v)}
                    className="inline-flex size-8 flex-none items-center justify-center rounded-md text-gray-400 hover:text-gray-600"
                  >
                    <EyeIcon off={showPw} />
                  </button>
                </div>
                <FieldError show={!!errors.password}>{t('login-password-error')}</FieldError>
              </div>
            </div>

            {/* 로그인 상태 유지 + 비밀번호 찾기 */}
            <div className="mt-4 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setRemember((v) => !v)}
                className="inline-flex items-center gap-2"
              >
                <span
                  className={`inline-flex size-[17px] flex-none items-center justify-center rounded border-[1.5px] text-white ${remember ? 'border-primary bg-primary' : 'border-gray-300 bg-card'}`}
                >
                  {remember && <CheckIcon className="size-3" strokeWidth={3.4} />}
                </span>
                <span className="text-s text-gray-600">{t('login-remember')}</span>
              </button>
              <button type="button" className="ml-auto text-s text-gray-500 hover:text-primary">
                {t('login-forgot')}
              </button>
            </div>

            {loginMutation.isError && (
              <p className="mt-4 rounded-md bg-destructive-bg px-3 py-2.5 text-s font-medium text-destructive">
                {t('login-error')}
              </p>
            )}

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="relative mt-5 flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-bold text-white transition-colors hover:bg-ov-blue-700"
            >
              {/* 빠른 응답이면 텍스트 유지, 250ms 넘어가면 CSS로 스피너 전환 (state 없이 깜빡임 방지) */}
              <span
                className={
                  loginMutation.isPending ? '[animation:login-hide_0s_250ms_forwards]' : undefined
                }
              >
                {t('login-submit')}
              </span>
              {loginMutation.isPending && (
                <span
                  className="absolute inset-0 flex [animation:login-show_0s_250ms_forwards] items-center justify-center opacity-0"
                  aria-label={t('login-loading')}
                >
                  <svg
                    className="size-6 animate-spin [animation-duration:0.7s]"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="currentColor"
                      strokeOpacity="0.3"
                      strokeWidth="3"
                    />
                    <path
                      d="M21 12a9 9 0 0 0-9-9"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              )}
            </button>
            {/* 하단 구분선 — 디자인 A-5 확정: 선만, 문구 없음(프로토타입 문구는 아트보드 전용) */}
            <div className="mt-auto border-t border-gray-100 pt-6" />
          </form>
        </div>
      </div>
    </div>
  )
}

// 항상 렌더링해 높이를 예약 → 유효성 메시지 토글 시 레이아웃 점프 방지
function FieldError({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <span className="flex min-h-[16px] items-center gap-1.5 text-xs text-destructive">
      {show && (
        <>
          <ErrorIcon />
          {children}
        </>
      )}
    </span>
  )
}

/* ── 디자인 그대로의 인라인 아이콘들 ── */
function WaveMark() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 14c2-4 4-4 6 0s4 4 6 0 4-4 6 0" />
    </svg>
  )
}

function WaveDecoration() {
  return (
    <svg
      viewBox="0 0 340 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-[-6px] h-[104px] w-full opacity-[0.22] min-[631px]:h-[130px]"
    >
      <path
        d="M0 62c46-30 92-30 138 0s92 30 138 0 64-22 64-22V120H0z"
        fill="#FFFFFF"
        opacity="0.35"
      />
      <path
        d="M0 86c46-26 92-26 138 0s92 26 138 0 64-18 64-18V120H0z"
        fill="#FFFFFF"
        opacity="0.5"
      />
    </svg>
  )
}
