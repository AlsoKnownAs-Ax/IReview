import { z } from 'zod'
import { rpc, type Client, type Contract } from '../rpc/contract'

const gitVersion = z.object({ major: z.number().int(), minor: z.number().int(), patch: z.number().int() })

export type GitVersion = z.infer<typeof gitVersion>

/** The oldest git the workspace host accepts (ADR-0005). */
export const MINIMUM_GIT_VERSION = { major: 2, minor: 40 } as const

/** How any git call can fail before its own output is read. */
const gitRunError = [
  z.object({ code: z.literal('GIT_MISSING') }),
  z.object({ code: z.literal('GIT_FAILED'), exitCode: z.number().int().optional(), stderr: z.string() }),
] as const

export type GitRunError = z.infer<(typeof gitRunError)[number]>

const gitVersionError = z.discriminatedUnion('code', [
  ...gitRunError,
  z.object({ code: z.literal('GIT_VERSION_UNRECOGNIZED'), output: z.string() }),
  z.object({ code: z.literal('GIT_TOO_OLD'), version: gitVersion }),
])

export type GitVersionError = z.infer<typeof gitVersionError>

const resolveRepoInput = z.object({ path: z.string() })

export type ResolveRepoInput = z.infer<typeof resolveRepoInput>

/** A folder's Repo: `identity` is the real path of its git common dir, the same for the Main checkout and its Worktrees. */
const resolvedRepo = z.object({
  identity: z.string(),
  /** The real path of the Main checkout or linked Worktree the folder is in. */
  checkoutRoot: z.string(),
})

export type ResolvedRepo = z.infer<typeof resolvedRepo>

const resolveRepoError = z.discriminatedUnion('code', [
  ...gitRunError,
  z.object({ code: z.literal('PATH_NOT_FOUND'), path: z.string() }),
  z.object({ code: z.literal('NOT_A_REPO'), path: z.string() }),
  z.object({ code: z.literal('WSL_UNSUPPORTED'), path: z.string() }),
])

export type ResolveRepoError = z.infer<typeof resolveRepoError>

/** What the per-Window workspace host serves (SPEC §5.2, ADR-0006). */
export const workspaceContract = {
  ping: rpc({ input: z.void(), result: z.literal('pong') }),
  gitVersion: rpc({ input: z.void(), result: gitVersion, error: gitVersionError }),
  resolveRepo: rpc({ input: resolveRepoInput, result: resolvedRepo, error: resolveRepoError }),
} satisfies Contract

export type WorkspaceClient = Client<typeof workspaceContract>
