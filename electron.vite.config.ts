import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

const shared = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: {
    resolve: { alias: { ...shared, '@main': resolve('src/main'), '@hosts': resolve('src/hosts') } },
    build: {
      rollupOptions: { input: { index: 'src/main/index.ts', 'workspace-host': 'src/hosts/workspace/index.ts' } },
    },
  },
  preload: {
    resolve: { alias: { ...shared, '@preload': resolve('src/preload') } },
  },
  renderer: {
    resolve: { alias: { ...shared, '@renderer': resolve('src/renderer/src') } },
    plugins: [react()],
  },
})
