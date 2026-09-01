import { useState } from 'react'

import { useTranslation } from 'react-i18next'

import { useMe } from '@/hooks/useMe'
import { useCompanySettingMutation } from '@/hooks/useSettings'

const DAY_OPTS = [7, 30, 60, 90]

// 환경 설정 › 메인화면. 최신글 노출 기간(company_settings.latest_post_day) —
// office 관리자만 저장 가능(POST /management/company-setting/{companySetting}).
export function MainScreenTab({ onToast }: { onToast: (msg: string) => void }) {
  const { t } = useTranslation()
  const { data: me } = useMe()
  const companySetting = me?.company_setting
  const mut = useCompanySettingMutation(companySetting?.id)

  const [draft, setDraft] = useState<number | null>(null)
  const days = draft ?? companySetting?.latest_post_day ?? 30
  const canSave = !!companySetting?.id && !!me?.is_admin

  const save = () => {
    if (!canSave) return
    mut.mutate(
      { latest_post_day: days },
      {
        onSuccess: () => onToast(t('admin-toast-saved')),
        onError: () => onToast(t('env-error')),
      },
    )
  }

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
              onClick={() => setDraft(d)}
              className="inline-flex items-center gap-2"
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

      {!canSave && <span className="pt-3 text-xs text-gray-400">{t('env-main-admin-only')}</span>}

      <div className="flex pt-3.5">
        <button
          type="button"
          onClick={save}
          disabled={!canSave || mut.isPending}
          className="ml-auto inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-semibold text-white hover:bg-ov-blue-700 disabled:opacity-40"
        >
          {t('common-save')}
        </button>
      </div>
    </div>
  )
}
