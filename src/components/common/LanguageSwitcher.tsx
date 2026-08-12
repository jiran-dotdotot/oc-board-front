import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n'

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()

  return (
    <div className="flex gap-1">
      {SUPPORTED_LANGUAGES.map((lng) => (
        <Button
          key={lng}
          size="sm"
          variant={i18n.resolvedLanguage === lng ? 'default' : 'outline'}
          onClick={() => i18n.changeLanguage(lng)}
        >
          {t(`language-${lng}`)}
        </Button>
      ))}
    </div>
  )
}
