import { oc } from '@orpc/contract'
import { z } from 'zod'
import { repoContract } from '@/repo/contract'
import type { Client } from '@/shared/rpc/rpc'

/** What the per-Window workspace host serves: the slices its domains export (SPEC §5.2, ADR-0006, ADR-0009, ADR-0010). */
export const workspaceContract = {
  ping: oc.output(z.literal('pong')),
  ...repoContract,
}

export type WorkspaceClient = Client<typeof workspaceContract>
