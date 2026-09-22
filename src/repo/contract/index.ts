import { oc } from '@orpc/contract'
import { z } from 'zod'
import { gitRunErrors, gitVersion, gitVersionErrors } from '@/shared/contract/git'
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
  ...gitRunErrors,
  /** No folder can be read at `path`: missing, a file, not accessible, or gone before git answered. */
  PATH_NOT_FOUND: { data: z.object({ code: z.literal('PATH_NOT_FOUND'), path: z.string() }) },
  NOT_A_REPO: { data: z.object({ code: z.literal('NOT_A_REPO'), path: z.string() }) },
  WSL_UNSUPPORTED: { data: z.object({ code: z.literal('WSL_UNSUPPORTED'), path: z.string() }) },
}

export type ResolveRepoError = DeclaredError<typeof resolveRepoErrors>

/** What a host serves for Repo identity and the git precondition a Repo needs (SPEC §5.3). */
export const repoContract = {
  gitVersion: oc.output(gitVersion).errors(gitVersionErrors),
  resolveRepo: oc.input(resolveRepoInput).output(resolvedRepo).errors(resolveRepoErrors),
}
