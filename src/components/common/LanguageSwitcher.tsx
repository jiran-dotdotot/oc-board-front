import { useTranslation } from 'react-i18next'

import { CheckIcon } from '@/components/common/icons'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n'

/**
 * 언어 전환. 정본(개선안 통합 앱 web·mobile)에도 레거시에도 **없는** 이 앱 고유 UI다 —
 * 레거시는 호스트가 넘기는 `?lang=` 으로만 언어가 정해졌다. 자사 로그인 배포에서는
 * 바꿀 방법이 필요해 남기되, 정본 프로필 메뉴 행(36px · gap 9 · 14px)과 같은 모양으로 둔다.
 *
 * 선택 표시는 색·굵기만이 아니라 체크(형태)로도 준다 — `Dropdown` 과 같은 관례.
 */
export function LanguageSwitcher({ onPick }: { onPick?: () => void }) {
  const { t, i18n } = useTranslation()

  return (
    <div role="group" aria-label={t('nav-language')}>
      {SUPPORTED_LANGUAGES.map((lng) => {
        const on = i18n.resolvedLanguage === lng
        return (
          <button
            key={lng}
            type="button"
            role="menuitemradio"
            aria-checked={on}
            onClick={() => {
              i18n.changeLanguage(lng)
              onPick?.()
            }}
            className={`flex h-9 w-full items-center gap-[9px] rounded-md px-2.5 text-sm hover:bg-gray-100 ${
              on ? 'font-semibold text-primary' : 'text-gray-800'
            }`}
          >
            {t(`language-${lng}`)}
            {on && <CheckIcon className="ml-auto size-3" strokeWidth={3} />}
          </button>
        )
      })}
    </div>
  )
}
