import { z } from 'zod'
import type { Result, RpcFailure } from './contract'

const messageId = z.number()

/**
 * The wire envelope. `id` pairs a response with its request, and a response carries a `Result`. Streams and events add
 * further `kind`s to `RpcMessage`; each side ignores kinds it does not handle.
 */
export const requestMessage = z.object({
  kind: z.literal('request'),
  id: messageId,
  method: z.string(),
  input: z.unknown(),
})
export const responseMessage = z.object({
  kind: z.literal('response'),
  id: messageId,
  data: z.unknown(),
  error: z.looseObject({ code: z.string() }).nullable(),
})
/**
 * Sent by the client. `stream` opens a stream and `subscribe` subscribes to an event; the host's messages for either
 * carry the same id, and `cancel` stops either by that id.
 */
export const clientMessage = z.discriminatedUnion('kind', [
  requestMessage,
  z.object({ kind: z.literal('stream'), id: messageId, method: z.string(), input: z.unknown() }),
  z.object({ kind: z.literal('subscribe'), id: messageId, event: z.string() }),
  z.object({ kind: z.literal('cancel'), id: messageId }),
])
/**
 * Sent by the host. A stream sends an `item` per value, then a `response` whose `error` is null when it completed. A
 * subscription is accepted or rejected with a `response`, then gets an `event` per payload.
 */
export const hostMessage = z.discriminatedUnion('kind', [
  responseMessage,
  z.object({ kind: z.literal('item'), id: messageId, data: z.unknown() }),
  z.object({ kind: z.literal('event'), id: messageId, payload: z.unknown() }),
])
export type RequestMessage = z.infer<typeof requestMessage>
export type ResponseMessage = z.infer<typeof responseMessage>
export type ClientMessage = z.infer<typeof clientMessage>
export type HostMessage = z.infer<typeof hostMessage>
export type RpcMessage = ClientMessage | HostMessage

export type SendFailed = Extract<RpcFailure, { code: 'SEND_FAILED' }>

/** The minimal duplex the rpc library runs over; each transport implements it (SPEC §5.2). */
export type Channel = {
  /** Transports map their own failures, such as a message that cannot be structured-cloned, to `SEND_FAILED`. */
  send(message: RpcMessage): Result<null, SendFailed>
  /** Incoming messages are untrusted, so they arrive as `unknown`. Returns a function that removes the listener. */
  onMessage(listener: (message: unknown) => void): () => void
}
