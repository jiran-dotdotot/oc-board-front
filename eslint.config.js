import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// Flat ESLint config for a React 19 + Vite + TS project.
// The current create-vite react-ts template ships oxlint instead — see BOOTSTRAP.md step 1
// (`npm rm oxlint && npm i -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks
//  eslint-plugin-react-refresh globals`), then copy this file to the project root.
export default tseslint.config(
  // Not linted: build output, generated shadcn UI, tests, Claude config, static public assets.
  {
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      'public/**',
      'tests/**',
      'src/components/ui/**',
      '.claude/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
)
