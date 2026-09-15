import { z } from 'zod'
import { rpc, type Client, type Contract } from '../rpc/contract'

const gitVersion = z.object({ major: z.number().int(), minor: z.number().int(), patch: z.number().int() })

export type GitVersion = z.infer<typeof gitVersion>

const gitVersionError = z.discriminatedUnion('code', [
  z.object({ code: z.literal('GIT_MISSING') }),
  z.object({ code: z.literal('GIT_FAILED'), exitCode: z.number().int().optional(), stderr: z.string() }),
  z.object({ code: z.literal('GIT_VERSION_UNRECOGNIZED'), output: z.string() }),
  z.object({ code: z.literal('GIT_TOO_OLD'), version: gitVersion }),
])

export type GitVersionError = z.infer<typeof gitVersionError>

/** What the per-Window workspace host serves (SPEC §5.2, ADR-0006). */
export const workspaceContract = {
  ping: rpc({ input: z.void(), result: z.literal('pong') }),
  /** The system git, which must be 2.40 or newer (ADR-0005). */
  gitVersion: rpc({ input: z.void(), result: gitVersion, error: gitVersionError }),
} satisfies Contract

export type WorkspaceClient = Client<typeof workspaceContract>
