import { createFileRoute } from '@tanstack/react-router'

import { SettingsScreen } from '@/components/settings/SettingsScreen'
import { parseSettingsSearch } from '@/components/settings/settingsParams'

export const Route = createFileRoute('/settings')({
  // 탭 선택의 정본은 URL 이다 — 새로고침·공유·뒤로가기가 살아난다.
  // 레거시도 `/setting`·`/setting/main`·`/setting/board/` 로 라우트가 갈려 있었다.
  // 기본값 `general` 은 URL 에 쓰지 않는다.
  validateSearch: parseSettingsSearch,
  component: SettingsScreen,
})
