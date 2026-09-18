import { createORPCClient, createSafeClient, type SafeClient } from '@orpc/client'
import { RPCLink, type SupportedMessagePort } from '@orpc/client/message-port'
import type { AnyContractRouter, ContractRouterClient } from '@orpc/contract'
import type { Router } from '@orpc/server'
import { RPCHandler } from '@orpc/server/message-port'

/** A DOM `MessagePort` or an Electron `MessagePortMain`. Both hold messages until `start()`. */
export type Port = SupportedMessagePort & { start(): void }

/**
 * Answers calls to `router` on `port` (ADR-0009). Inputs are validated before a handler runs, and outputs and declared
 * errors before sending. Anything else a handler throws reaches the client as a bare `INTERNAL_SERVER_ERROR`.
 */
export function serve(router: Router<AnyContractRouter, Record<never, never>>, port: Port): void {
  new RPCHandler(router).upgrade(port)
  port.start()
}

/** A typed client for contract `C` over `port`. Calls resolve to `{ error, data }` and never reject. */
export function connect<C extends AnyContractRouter>(port: Port): SafeClient<ContractRouterClient<C>> {
  const client: ContractRouterClient<C> = createORPCClient(new RPCLink({ port }))
  port.start()
  return createSafeClient(client)
}
