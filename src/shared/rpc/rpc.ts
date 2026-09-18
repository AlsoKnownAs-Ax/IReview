import { createORPCClient, createSafeClient, type SafeClient } from '@orpc/client'
import { RPCLink, type SupportedMessagePort } from '@orpc/client/message-port'
import type { AnyContractRouter, ContractRouterClient, ErrorMap, ErrorMapItem, InferSchemaOutput } from '@orpc/contract'
import type { ORPCErrorConstructorMap, Router } from '@orpc/server'
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

/** A procedure's declared errors as coded values: each is the `data` of its entry in the error map, code included. */
export type DeclaredError<M extends ErrorMap> = {
  [C in keyof M]: M[C] extends ErrorMapItem<infer S> ? InferSchemaOutput<S> : never
}[keyof M]

/**
 * The error a handler throws for a `Result` error: the one its procedure declares under the same code, carrying the
 * error as `data` (ADR-0009). This is the one throw at the oRPC boundary; the code below a handler stays Result-based.
 */
export function declaredError<M extends ErrorMap>(errors: ORPCErrorConstructorMap<M>, error: DeclaredError<M>): Error {
  const { code } = error as { code: keyof M }
  const construct = errors[code] as unknown as (options: { data: unknown }) => Error
  return construct({ data: error })
}
