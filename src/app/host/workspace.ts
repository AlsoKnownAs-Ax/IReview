import type { workspaceContract } from '@/shared/contract/workspace'
import { serve } from '@/shared/rpc/rpc'
import { workspaceRouter } from './workspace-router'

const router = workspaceRouter()

// Main hands over one port per renderer page load (SPEC §5.1–5.2); oRPC stops serving a port once it closes.
process.parentPort.on('message', ({ ports: [port] }) => {
  if (!port) {
    return
  }

  serve<typeof workspaceContract>(router, port)
})
