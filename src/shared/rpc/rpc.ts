import { createORPCClient, createSafeClient, isDefinedError, ORPCError, type SafeClient } from '@orpc/client'
import {
  onMessagePortClose,
  onMessagePortMessage,
  postMessagePortMessage,
  RPCLink,
  type MessagePortMainLike,
  type SupportedMessagePort,
} from '@orpc/client/message-port'
import type { AnyContractRouter, ContractRouterClient, ErrorMap, ErrorMapItem, InferSchemaOutput } from '@orpc/contract'
import { onError, type ORPCErrorConstructorMap, type Router } from '@orpc/server'
import { RPCHandler } from '@orpc/server/message-port'
import { isObject, preventNativeAwait } from '@orpc/shared'
import { decodeRequestMessage, deserializeRequestMessage, type EncodedMessage } from '@orpc/standard-server-peer'

/** A DOM `MessagePort` or an Electron `MessagePortMain`. Both hold messages until `start()`. */
export type Port = SupportedMessagePort & { start(): void }

/** What a caller of contract `C` holds: each call resolves to `{ error, data }` and never rejects. */
export type Client<C extends AnyContractRouter> = SafeClient<ContractRouterClient<C>>

/**
 * Answers calls on `port` with `router`, which must implement all of contract `C`; name `C` explicitly (ADR-0009).
 * Inputs are validated before a handler runs, and outputs and declared errors before sending. Anything else a handler
 * throws reaches the client as a bare `INTERNAL_SERVER_ERROR` and is logged here.
 */
export function serve<C extends AnyContractRouter = never>(
  router: Router<NoInfer<C>, Record<never, never>>,
  port: Port,
): void {
  new RPCHandler(router, { interceptors: [onError(logUnexpected)] }).upgrade(decodableRequests(port))
  port.start()
}

/**
 * A typed client for contract `C` over `port`. Once the port closes, calls in flight settle with an abort error and
 * later calls with `SERVICE_UNAVAILABLE`, so none hangs.
 */
export function connect<C extends AnyContractRouter>(port: Port): Client<C> {
  const state = { isClosed: false }
  onMessagePortClose(port, () => (state.isClosed = true))
  const link = new RPCLink({
    port,
    interceptors: [
      ({ next }): Promise<unknown> => {
        if (state.isClosed) return portClosed()
        return next()
      },
    ],
  })
  const client: ContractRouterClient<C> = createORPCClient(link)
  port.start()
  return unawaitable(createSafeClient(client))
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

/** oRPC would post a call on a closed port to nobody and wait for an answer forever. */
function portClosed(): Promise<never> {
  return Promise.reject(new ORPCError('SERVICE_UNAVAILABLE', { message: 'The port is closed' }))
}

/** Declared errors are answers; anything else is a bug or a misbehaving peer, worth a line in the host's log. */
function logUnexpected(error: unknown): void {
  if (isDefinedError(error)) return
  console.error('rpc: a call failed', error)
}

/**
 * `port` as oRPC's handler reads it, minus messages it could not decode. oRPC decodes in a listener nobody awaits, so
 * one malformed message from the least-trusted peer would be an unhandled rejection that ends the host (ADR-0006).
 * Messages are checked one at a time, so the ones that pass keep their order.
 */
function decodableRequests(port: Port): MessagePortMainLike {
  let checked = Promise.resolve()
  return {
    on: (event, callback): void => {
      if (event === 'close') onMessagePortClose(port, () => callback())
      if (event !== 'message') return
      onMessagePortMessage(port, (data): void => {
        checked = checked.then(async (): Promise<void> => {
          if (await isDecodable(data)) return callback({ data })
          console.error('rpc: dropped a message that is not an oRPC request')
        })
      })
    },
    postMessage: (data, transfer): void => postMessagePortMessage(port, data, transfer),
  }
}

async function isDecodable(message: unknown): Promise<boolean> {
  try {
    await decodeLikeHandler(message)
    return true
  } catch {
    return false
  }
}

/** Decodes `message` the way oRPC's MessagePort handler will: plain objects arrive already deserialized. */
async function decodeLikeHandler(message: unknown): Promise<unknown> {
  if (isObject(message))
    return deserializeRequestMessage(message as unknown as Parameters<typeof deserializeRequestMessage>[0])
  return decodeRequestMessage(message as EncodedMessage)
}

/**
 * Keeps every level of a safe client from being awaited as a thenable. A safe client answers every property, `then`
 * included, and oRPC only guards its plain client, so resolving a Promise with one would call it instead.
 */
function unawaitable<T extends object>(client: T): T {
  return preventNativeAwait(
    new Proxy(client, {
      get(target, key, receiver): unknown {
        const value: unknown = Reflect.get(target, key, receiver)
        if (typeof key !== 'string' || key === 'then' || typeof value !== 'function') return value
        return unawaitable(value)
      },
    }),
  )
}
