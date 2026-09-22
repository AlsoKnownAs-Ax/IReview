import { implement, type Router } from '@orpc/server'
import type { ResolvedRepo } from '@/repo/contract'
import type { RepoRegistry } from '@/repo/main'
import { mainContract } from '@/shared/contract/main'

export type MainRouter = Router<typeof mainContract, Record<never, never>>

export type MainRouterOptions = {
  /** Shows the native folder picker; resolves to the path, or `null` when cancelled. */
  pickFolder: () => Promise<string | null>
  registry: RepoRegistry
  /** The Repo the Window is bound to; absent for the Welcome Window. */
  repo?: ResolvedRepo
}

const os = implement(mainContract)

/** What main serves one Window on each port it brokers to it. */
export function mainRouter({ pickFolder, registry, repo }: MainRouterOptions): MainRouter {
  return os.router({
    pickFolder: os.pickFolder.handler(() => pickFolder()),
    openRepo: os.openRepo.handler(({ input }) => registry.open(input)),
    windowRepo: os.windowRepo.handler(() => repo ?? null),
  })
}
