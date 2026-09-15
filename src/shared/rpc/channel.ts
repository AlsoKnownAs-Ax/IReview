import { z } from 'zod'
import type { Result } from './contract'

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
export type RequestMessage = z.infer<typeof requestMessage>
export type ResponseMessage = z.infer<typeof responseMessage>
export type RpcMessage = RequestMessage | ResponseMessage

/** The minimal duplex the rpc library runs over; each transport implements it (SPEC §5.2). */
export type Channel = {
  /** May throw, such as for a message that cannot be structured-cloned. */
  send(message: RpcMessage): void
  /** Incoming messages are untrusted, so they arrive as `unknown`. Returns a function that removes the listener. */
  onMessage(listener: (message: unknown) => void): () => void
}

/** `channel.send` with a throwing transport mapped to an error value. */
export function trySend(channel: Channel, message: RpcMessage): Result<null, { code: 'SEND_FAILED' }> {
  try {
    channel.send(message)
    return { data: null, error: null }
  } catch {
    return { data: null, error: { code: 'SEND_FAILED' } }
  }
}
