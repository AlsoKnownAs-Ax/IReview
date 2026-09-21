import { resolve } from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@main': resolve('src/main'),
      '@hosts': resolve('src/hosts'),
      '@preload': resolve('src/preload'),
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared'),
      '@tests': resolve('tests'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'tests/e2e/**', 'out/**'],
  },
})
