import { useState } from 'react'

import { useTranslation } from 'react-i18next'

import { DAY_OPTS, LATEST_POST_DAY_DEFAULT } from './constants'
import { useMe } from '@/hooks/useMe'
import { useCompanySettingMutation } from '@/hooks/useSettings'

// 환경 설정 › 메인화면. 최신글 노출 기간(company_settings.latest_post_day).
// 저장은 PATCH {company}/settings 이고 **회사 관리자만** 통과한다 — 권한은 서버가 판정하고
// 화면은 관리자가 아니면 고를 수 없게 둔다(고를 수 있는데 저장은 안 되는 상태를 만들지 않는다).
export function MainScreenTab({
  onToast,
}: {
  onToast: (msg: string, tone?: 'success' | 'error') => void
}) {
  const { t } = useTranslation()
  const { data: me } = useMe()
  const companySetting = me?.company_setting
  const saved = companySetting?.latest_post_day ?? LATEST_POST_DAY_DEFAULT
  const isAdmin = !!me?.is_admin
  const mutation = useCompanySettingMutation()
  const [picked, setPicked] = useState<number | null>(null)
  const days = picked ?? saved

  return (
    <div className="flex max-w-[860px] flex-col">
      <span className="pt-1.5 pb-0.5 text-base font-bold">{t('env-main-title')}</span>
      <span className="text-xs text-gray-400">{t('env-main-desc')}</span>

      <div className="mt-3.5 flex flex-col gap-2 border-y border-gray-100 py-4">
        <span className="text-sm font-semibold">{t('env-main-days')}</span>
        <span className="text-xs text-gray-400">{t('env-main-days-desc')}</span>
        <div
          role="radiogroup"
          aria-label={t('env-main-days')}
          className="flex flex-wrap gap-6 pt-1.5"
        >
          {DAY_OPTS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={days === d}
              disabled={!isAdmin}
              onClick={() => setPicked(d)}
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

      {/* 관리자가 아니면 왜 못 바꾸는지 남긴다 — 비활성은 색·opacity 로만 전달되면 안 된다. */}
      {!isAdmin && <span className="pt-3 text-xs text-gray-400">{t('env-main-admin-only')}</span>}

      <div className="flex pt-3.5">
        <button
          type="button"
          disabled={!isAdmin || mutation.isPending || days === saved}
          onClick={() =>
            mutation.mutate(
              { latest_post_day: days },
              {
                onSuccess: () => {
                  setPicked(null)
                  onToast(t('admin-toast-saved'))
                },
                onError: () => onToast(t('env-save-error'), 'error'),
              },
            )
          }
          className="ml-auto inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-semibold text-white hover:bg-ov-blue-700 disabled:opacity-40"
        >
          {t('common-save')}
        </button>
      </div>
    </div>
  )
}
