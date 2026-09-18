import { implement } from '@orpc/server'
import { workspaceContract } from '../../shared/contract/workspace'
import { serve } from '../../shared/rpc/rpc'

const os = implement(workspaceContract)
const router = os.router({
  ping: os.ping.handler(() => 'pong' as const),
})

// Main hands over one port per renderer page load (SPEC §5.1–5.2); oRPC stops serving a port once it closes.
process.parentPort.on('message', ({ ports: [port] }): void => {
  if (!port) return
  serve<typeof workspaceContract>(router, port)
})
