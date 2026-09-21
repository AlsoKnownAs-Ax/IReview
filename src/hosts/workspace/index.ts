import { implement } from '@orpc/server'
import { workspaceContract } from '@shared/contract/workspace'
import { declaredError, serve } from '@shared/rpc/rpc'
import { detectGitVersion } from './git/git-version'
import { resolveRepo } from './git/resolve-repo'

const os = implement(workspaceContract)
const router = os.router({
  ping: os.ping.handler(() => 'pong' as const),
  gitVersion: os.gitVersion.handler(async ({ errors }) => {
    const { data: version, error } = await detectGitVersion()

    if (error) {
      throw declaredError(errors, error)
    }

    return version
  }),
  resolveRepo: os.resolveRepo.handler(async ({ input, errors }) => {
    const { data: repo, error } = await resolveRepo(input)

    if (error) {
      throw declaredError(errors, error)
    }

    return repo
  }),
})

// Main hands over one port per renderer page load (SPEC §5.1–5.2); oRPC stops serving a port once it closes.
process.parentPort.on('message', ({ ports: [port] }) => {
  if (!port) return
  serve<typeof workspaceContract>(router, port)
})
