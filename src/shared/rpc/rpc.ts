import { createORPCClient, createSafeClient, type SafeClient } from '@orpc/client'
import { RPCLink, type SupportedMessagePort } from '@orpc/client/message-port'
import type { AnyContractRouter, ContractRouterClient } from '@orpc/contract'
import type { Router } from '@orpc/server'
import { RPCHandler } from '@orpc/server/message-port'
import { preventNativeAwait } from '@orpc/shared'

/** A DOM `MessagePort` or an Electron `MessagePortMain`. Both hold messages until `start()`. */
export type Port = SupportedMessagePort & { start(): void }

/** What a caller of contract `C` holds: each call resolves to `{ error, data }` and never rejects. */
export type Client<C extends AnyContractRouter> = SafeClient<ContractRouterClient<C>>

/**
 * Answers calls to `router` on `port` (ADR-0009). Inputs are validated before a handler runs, and outputs and declared
 * errors before sending. Anything else a handler throws reaches the client as a bare `INTERNAL_SERVER_ERROR`.
 */
export function serve(router: Router<AnyContractRouter, Record<never, never>>, port: Port): void {
  new RPCHandler(router).upgrade(port)
  port.start()
}

/**
 * A typed client for contract `C` over `port`. A safe client answers every property, `then` included, so without
 * `preventNativeAwait` resolving a Promise with one would call it as a thenable instead of handing it over.
 */
export function connect<C extends AnyContractRouter>(port: Port): Client<C> {
  const client: ContractRouterClient<C> = createORPCClient(new RPCLink({ port }))
  port.start()
  return preventNativeAwait(createSafeClient(client))
}
