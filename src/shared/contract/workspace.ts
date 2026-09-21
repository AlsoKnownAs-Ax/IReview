import { oc } from '@orpc/contract'
import { z } from 'zod'
import type { Client, DeclaredError } from '@shared/rpc/rpc'

const gitVersion = z.object({ major: z.number().int(), minor: z.number().int(), patch: z.number().int() })

export type GitVersion = z.infer<typeof gitVersion>

/** The oldest git the workspace host accepts (ADR-0005). */
export const MINIMUM_GIT_VERSION = { major: 2, minor: 40 } as const

/** How any git call can fail before its own output is read. */
const gitRunErrors = {
  GIT_MISSING: { data: z.object({ code: z.literal('GIT_MISSING') }) },
  GIT_FAILED: {
    data: z.object({ code: z.literal('GIT_FAILED'), exitCode: z.number().int().optional(), stderr: z.string() }),
  },
}

export type GitRunError = DeclaredError<typeof gitRunErrors>

const gitVersionErrors = {
  ...gitRunErrors,
  GIT_VERSION_UNRECOGNIZED: { data: z.object({ code: z.literal('GIT_VERSION_UNRECOGNIZED'), output: z.string() }) },
  GIT_TOO_OLD: { data: z.object({ code: z.literal('GIT_TOO_OLD'), version: gitVersion }) },
}

export type GitVersionError = DeclaredError<typeof gitVersionErrors>

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

/** What the per-Window workspace host serves (SPEC §5.2, ADR-0006, ADR-0009). */
export const workspaceContract = {
  ping: oc.output(z.literal('pong')),
  gitVersion: oc.output(gitVersion).errors(gitVersionErrors),
  resolveRepo: oc.input(resolveRepoInput).output(resolvedRepo).errors(resolveRepoErrors),
}

export type WorkspaceClient = Client<typeof workspaceContract>
