import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vitest/config'

// Minimal Vitest config for a React + Vite + TS project.
// Tests live in tests/** (outside src/). happy-dom is lighter than jsdom.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    // Don't fail when a fresh project has no test files yet (otherwise the
    // .husky/pre-push gate blocks the first push). Single source of truth.
    passWithNoTests: true,
    // Keep Playwright E2E specs (tests/e2e/**) out of Vitest — they run via playwright.config.ts (M7).
    exclude: ['**/node_modules/**', 'tests/e2e/**'],
  },
  resolve: {
    // import.meta.dirname (Node 20.11+) — avoids the __dirname deprecation warning under Vite's
    // native config loader. Requires the .nvmrc Node version.
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
})
