import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  globalIgnores(['out/**', 'dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: [
      'src/main/**',
      'src/hosts/**',
      'src/preload/**',
      'src/shared/**',
      'tests/**',
      '*.config.{ts,mjs,cjs}',
      '.dependency-cruiser.cjs',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  prettier,
)
