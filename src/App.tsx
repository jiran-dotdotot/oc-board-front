import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n'

function App() {
  const { t, i18n } = useTranslation()

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t('app-name')}</h1>
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
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t('board-list-title')}</h2>
        <p className="text-muted-foreground">{t('board-empty')}</p>
        <div className="flex gap-2">
          <Button>{t('board-write')}</Button>
          <Button variant="outline">{t('common-search')}</Button>
        </div>
      </section>
    </main>
  )
}

export default App
