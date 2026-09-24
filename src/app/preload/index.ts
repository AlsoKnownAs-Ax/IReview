import { ipcRenderer } from 'electron'
import { PORTS } from '@/shared/contract/ports'

// A MessagePort cannot cross contextIsolation through contextBridge, so each port main brokers is transferred into the
// page under its own name. Preload exposes nothing else (SPEC §5.2).
PORTS.forEach((name) => {
  ipcRenderer.on(name, ({ ports }) => {
    window.postMessage(name, location.origin, ports)
  })
})
