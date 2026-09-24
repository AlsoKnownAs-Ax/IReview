import { repoMainContract } from '@/repo/contract'
import type { Client } from '@/shared/rpc/rpc'

/** What main serves each Window over the port it brokers per page load: the slices its domains export (SPEC §5.2). */
export const mainContract = {
  ...repoMainContract,
}

export type MainClient = Client<typeof mainContract>
