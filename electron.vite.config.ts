import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {
    build: {
      rollupOptions: { input: { index: 'src/main/index.ts', 'workspace-host': 'src/hosts/workspace/index.ts' } },
    },
  },
  preload: {},
  renderer: {
    plugins: [react()],
  },
})
