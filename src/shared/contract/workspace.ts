import { z } from 'zod'
import { rpc, type Client, type Contract } from '../rpc/contract'

/** What the per-Window workspace host serves (SPEC §5.2, ADR-0006). */
export const workspaceContract = {
  ping: rpc({ input: z.void(), result: z.literal('pong') }),
} satisfies Contract

export type WorkspaceClient = Client<typeof workspaceContract>
