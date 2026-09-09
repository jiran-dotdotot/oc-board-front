import { useTranslation } from 'react-i18next'

import { useMe } from '@/hooks/useMe'
import { MEMBER_SETTINGS_UNSUPPORTED } from '@/services/settingService'

const DAY_OPTS = [7, 30, 60, 90]

// 환경 설정 › 메인화면. 최신글 노출 기간(company_settings.latest_post_day).
// 저장 경로(PATCH /companies/{id}/settings)는 member 토큰 전용이라 이 앱에서는 «읽기 전용»이다
// — 고를 수 있는데 저장은 안 되는 상태를 만들지 않으려고 라디오까지 비활성으로 둔다(BR-012).
export function MainScreenTab() {
  const { t } = useTranslation()
  const { data: me } = useMe()
  const companySetting = me?.company_setting
  const days = companySetting?.latest_post_day ?? 30
  const isAdmin = !!me?.is_admin

  return (
    <div className="flex max-w-[860px] flex-col">
      <span className="pt-1.5 pb-0.5 text-base font-bold">{t('env-main-title')}</span>
      <span className="text-xs text-gray-400">{t('env-main-desc')}</span>

      <div className="mt-3.5 flex flex-col gap-2 border-y border-gray-100 py-4">
        <span className="text-sm font-semibold">{t('env-main-days')}</span>
        <span className="text-xs text-gray-400">{t('env-main-days-desc')}</span>
        <div className="flex flex-wrap gap-6 pt-1.5">
          {DAY_OPTS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={days === d}
              disabled
              className="inline-flex items-center gap-2 disabled:opacity-100"
            >
              <span
                className={[
                  'size-[17px] flex-none rounded-full border bg-card',
                  days === d ? 'border-[5px] border-primary' : 'border-[1.5px] border-gray-300',
                ].join(' ')}
              />
              <span className="text-sm text-gray-800">{t('env-main-day', { n: d })}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 두 사유는 서로 다르다 — 관리자가 아니면 「관리자만」, 관리자여도 저장 경로가 없으면
          「member 토큰 필요」다. 하나로 합치면 사용자에게 틀린 이유가 나간다. */}
      <span className="pt-3 text-xs text-gray-400">
        {isAdmin ? t('env-member-token-only') : t('env-main-admin-only')}
      </span>

      <div className="flex pt-3.5">
        <button
          type="button"
          disabled={MEMBER_SETTINGS_UNSUPPORTED}
          className="ml-auto inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-semibold text-white hover:bg-ov-blue-700 disabled:opacity-40"
        >
          {t('common-save')}
        </button>
      </div>
    </div>
  )
}
