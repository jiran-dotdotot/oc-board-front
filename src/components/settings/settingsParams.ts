// URL 쿼리 파서. 순수함수다(단위 테스트 대상).
import { ENV_TABS } from './constants'
import type { EnvTab } from './types'

/** `?tab=` 만 상태로 쓴다. 기본값(`general`)과 알 수 없는 값은 생략으로 떨어뜨린다. */
export interface SettingsSearch {
  tab?: Exclude<EnvTab, 'general'>
}

/** TanStack Router `validateSearch` 본체. */
export function parseSettingsSearch(search: Record<string, unknown>): SettingsSearch {
  const tab = String(search.tab ?? '') as EnvTab
  return {
    tab:
      tab !== 'general' && ENV_TABS.includes(tab) ? (tab as Exclude<EnvTab, 'general'>) : undefined,
  }
}
