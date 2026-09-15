import { workspaceContract } from '../../shared/contract/workspace'
import { createMessagePortMainChannel } from '../../shared/rpc/port-channel'
import { serve } from '../../shared/rpc/server'

// Main hands over one port per renderer page load (SPEC §5.1–5.2); each is served until the page lets go of it.
process.parentPort.on('message', ({ ports: [port] }): void => {
  if (!port) return
  const stop = serve(workspaceContract, { ping: () => 'pong' as const }, createMessagePortMainChannel(port))
  port.on('close', stop)
})
