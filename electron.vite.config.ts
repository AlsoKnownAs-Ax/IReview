import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

const RENDERER_ROOT = 'src/app/renderer'

const alias = { '@': resolve('src') }

export default defineConfig({
  main: {
    resolve: { alias },
    build: {
      rollupOptions: { input: { index: 'src/app/main/index.ts', 'workspace-host': 'src/app/host/workspace.ts' } },
    },
  },
  preload: {
    resolve: { alias },
    build: { rollupOptions: { input: { index: 'src/app/preload/index.ts' } } },
  },
  renderer: {
    root: RENDERER_ROOT,
    resolve: { alias },
    build: { rollupOptions: { input: { index: resolve(RENDERER_ROOT, 'index.html') } } },
    plugins: [react(), tailwindcss()],
  },
})
