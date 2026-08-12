import { defineConfig, devices } from '@playwright/test'

// E2E config. testDir is tests/e2e/ so Playwright specs don't collide with Vitest's tests/ (M7).
// 전용 포트(5188, strictPort)로 dev 서버를 기동해 다른 로컬 서버(예: 5173)와 충돌을 피함.
// 원격/사전 기동 서버를 쓰려면 PLAYWRIGHT_BASE_URL로 덮어쓰기.
const E2E_PORT = 5188
const E2E_HOST = `http://localhost:${E2E_PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || E2E_HOST,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${E2E_PORT} --strictPort`,
    url: process.env.PLAYWRIGHT_BASE_URL || E2E_HOST,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
