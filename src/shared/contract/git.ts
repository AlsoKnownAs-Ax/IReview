import { z } from 'zod'
import type { DeclaredError } from '@/shared/rpc/rpc'

/**
 * The system git CLI's wire shapes. They belong to no domain: `repo`, `session` and `review` all shell out to git
 * (ADR-0010), so the schemas live beside the other platform-free leaves rather than in one domain's contract.
 */

/** How any git call can fail before its own output is read. */
export const gitRunErrors = {
  GIT_MISSING: { data: z.object({ code: z.literal('GIT_MISSING') }) },
  GIT_FAILED: {
    data: z.object({ code: z.literal('GIT_FAILED'), exitCode: z.number().int().optional(), stderr: z.string() }),
  },
}

export type GitRunError = DeclaredError<typeof gitRunErrors>

export const gitVersion = z.object({ major: z.number().int(), minor: z.number().int(), patch: z.number().int() })

export type GitVersion = z.infer<typeof gitVersion>

/** The oldest git the workspace host accepts (ADR-0005). */
export const MINIMUM_GIT_VERSION = { major: 2, minor: 40 } as const

export const gitVersionErrors = {
  ...gitRunErrors,
  GIT_VERSION_UNRECOGNIZED: { data: z.object({ code: z.literal('GIT_VERSION_UNRECOGNIZED'), output: z.string() }) },
  GIT_TOO_OLD: { data: z.object({ code: z.literal('GIT_TOO_OLD'), version: gitVersion }) },
}

export type GitVersionError = DeclaredError<typeof gitVersionErrors>
