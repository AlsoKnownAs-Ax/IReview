import { oc } from '@orpc/contract'
import { z } from 'zod'
import type { Client } from '../rpc/rpc'

/** What the per-Window workspace host serves (SPEC §5.2, ADR-0006, ADR-0009). */
export const workspaceContract = {
  ping: oc.output(z.literal('pong')),
}

export type WorkspaceClient = Client<typeof workspaceContract>
