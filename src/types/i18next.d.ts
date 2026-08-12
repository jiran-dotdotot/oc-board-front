// Type-safe i18n: augments react-i18next's t() with the ko locale's key set.
// ko is the source of truth (en/ja are kept key-identical by the i18n-check hook).
import type ko from '@/locales/ko.json'
import 'i18next'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: {
      translation: typeof ko
    }
  }
}
