import { implement } from '@orpc/server'
import { workspaceContract } from '../../shared/contract/workspace'
import { declaredError, serve } from '../../shared/rpc/rpc'
import { detectGitVersion } from './git/git-version'

const os = implement(workspaceContract)
const router = os.router({
  ping: os.ping.handler(() => 'pong' as const),
  gitVersion: os.gitVersion.handler(async ({ errors }) => {
    const { data: version, error } = await detectGitVersion()
    if (error) throw declaredError(errors, error)
    return version
  }),
})

// Main hands over one port per renderer page load (SPEC §5.1–5.2); oRPC stops serving a port once it closes.
process.parentPort.on('message', ({ ports: [port] }): void => {
  if (!port) return
  serve<typeof workspaceContract>(router, port)
})
