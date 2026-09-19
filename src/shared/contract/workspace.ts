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

/** What the per-Window workspace host serves (SPEC §5.2, ADR-0006, ADR-0009). */
export const workspaceContract = {
  ping: oc.output(z.literal('pong')),
  gitVersion: oc.output(gitVersion).errors(gitVersionErrors),
}

export type WorkspaceClient = Client<typeof workspaceContract>
