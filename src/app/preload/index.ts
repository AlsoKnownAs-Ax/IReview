import { ipcRenderer } from 'electron'
import { WORKSPACE_HOST_PORT } from '@/shared/contract/ports'

// A MessagePort cannot cross contextIsolation through contextBridge, so the port main brokers is transferred into the
// page. Preload exposes nothing else (SPEC §5.2).
ipcRenderer.on(WORKSPACE_HOST_PORT, ({ ports }) => {
  window.postMessage(WORKSPACE_HOST_PORT, location.origin, ports)
})
