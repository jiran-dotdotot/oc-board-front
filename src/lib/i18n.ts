import { initReactI18next } from 'react-i18next'

import en from '@/locales/en.json'
import ja from '@/locales/ja.json'
import ko from '@/locales/ko.json'
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

export const SUPPORTED_LANGUAGES = ['ko', 'en', 'ja'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: SupportedLanguage = 'ko'

export const resources = {
  ko: { translation: ko },
  en: { translation: en },
  ja: { translation: ja },
}

// Detect the initial language (localStorage → browser navigator), falling back to ko.
// Resources are bundled inline (no async backend), so init synchronously
// (initAsync: false) and skip Suspense — t() is ready on first render.
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    // Map regional codes (en-US → en, ja-JP → ja) onto our base languages.
    load: 'languageOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'oc-board-lang',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
    initAsync: false,
    react: { useSuspense: false },
  })

export default i18n
