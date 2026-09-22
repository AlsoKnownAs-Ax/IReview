import { implement, type Router } from '@orpc/server'
import { detectGitVersion } from '@/git'
import { resolveRepo } from '@/repo/host'
import { workspaceContract } from '@/shared/contract/workspace'
import { declaredError } from '@/shared/rpc/rpc'

export type WorkspaceRouter = Router<typeof workspaceContract, Record<never, never>>

export type WorkspaceRouterOptions = {
  /** Stands in for the system git when checking its version, so a test can provoke each failure. */
  gitExecutable?: string
}

const os = implement(workspaceContract)

/** What the workspace host serves on each port main hands it. */
export function workspaceRouter({ gitExecutable }: WorkspaceRouterOptions = {}): WorkspaceRouter {
  return os.router({
    ping: os.ping.handler(() => 'pong' as const),
    gitVersion: os.gitVersion.handler(async ({ errors }) => {
      const { data: version, error } = await detectGitVersion({ executable: gitExecutable })

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
}
