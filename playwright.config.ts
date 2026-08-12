import { defineConfig, devices } from '@playwright/test'

// E2E config. testDir is tests/e2e/ so Playwright specs don't collide with Vitest's tests/ (M7).
// Assumes the dev server is already running on port 3000 (or set PLAYWRIGHT_BASE_URL).
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // To auto-start the app during E2E, uncomment:
  // webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI },
})
