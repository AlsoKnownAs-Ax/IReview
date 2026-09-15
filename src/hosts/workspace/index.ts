import { workspaceContract } from '../../shared/contract/workspace'
import type { Handlers } from '../../shared/rpc/contract'
import { createMessagePortMainChannel } from '../../shared/rpc/port-channel'
import { serve } from '../../shared/rpc/server'
import { detectGitVersion } from './git/git-version'
import { resolveRepo } from './git/resolve-repo'

const handlers: Handlers<typeof workspaceContract> = {
  ping: () => ({ data: 'pong', error: null }),
  gitVersion: detectGitVersion,
  resolveRepo,
}

// Main hands over one port per renderer page load (SPEC §5.1–5.2); each is served until the page lets go of it.
process.parentPort.on('message', ({ ports: [port] }): void => {
  if (!port) return
  const { stop } = serve(workspaceContract, handlers, createMessagePortMainChannel(port))
  port.on('close', stop)
})
