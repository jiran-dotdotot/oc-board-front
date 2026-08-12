import { Link, Outlet } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'

export function RootLayout() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-semibold">{t('app-name')}</h1>
          <nav className="flex gap-3 text-sm">
            <Link to="/" className="text-muted-foreground [&.active]:text-foreground">
              {t('nav-board')}
            </Link>
            <Link to="/write" className="text-muted-foreground [&.active]:text-foreground">
              {t('board-write')}
            </Link>
          </nav>
        </div>
        <LanguageSwitcher />
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
