import { oc } from '@orpc/contract'
import { z } from 'zod'
import { gitVersion, gitVersionErrors, repoPathsErrors } from '@/shared/contract/git'
import type { DeclaredError } from '@/shared/rpc/rpc'

const resolveRepoInput = z.object({ path: z.string() })

export type ResolveRepoInput = z.infer<typeof resolveRepoInput>

/** A folder's Repo: `identity` is the real path of its git common dir, the same for the Main checkout and its Worktrees. */
const resolvedRepo = z.object({
  identity: z.string(),
  /** The real path of the Main checkout or linked Worktree the folder is in. */
  checkoutRoot: z.string(),
})

export type ResolvedRepo = z.infer<typeof resolvedRepo>

const resolveRepoErrors = {
  ...repoPathsErrors,
  /** No folder can be read at `path`: missing, a file, not accessible, or gone before git answered. */
  PATH_NOT_FOUND: { data: z.object({ code: z.literal('PATH_NOT_FOUND'), path: z.string() }) },
  WSL_UNSUPPORTED: { data: z.object({ code: z.literal('WSL_UNSUPPORTED'), path: z.string() }) },
}

export type ResolveRepoError = DeclaredError<typeof resolveRepoErrors>

/** What a host serves for Repo identity and the git precondition a Repo needs (SPEC §5.3). */
export const repoContract = {
  gitVersion: oc.output(gitVersion).errors(gitVersionErrors),
  resolveRepo: oc.input(resolveRepoInput).output(resolvedRepo).errors(resolveRepoErrors),
}

/**
 * What main serves a Window for opening Repos (SPEC §3.1). Main runs no git (ADR-0005), so `openRepo` trusts the
 * Repo the renderer resolved: at worst a renderer opens or focuses a Window, which it may do anyway.
 */
export const repoMainContract = {
  /** Shows the native folder picker; `null` when it was cancelled. */
  pickFolder: oc.output(z.string().nullable()),
  /** Opens a Window for the Repo, or focuses the one already open for its identity. */
  openRepo: oc.input(resolvedRepo).output(z.void()),
  /** The Repo this Window is bound to; `null` for the Welcome Window. */
  windowRepo: oc.output(resolvedRepo.nullable()),
}
