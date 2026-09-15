import { z } from 'zod'

const messageId = z.number()

/**
 * The wire envelope. `id` pairs a response with its request. Streams and events add further `kind`s to `RpcMessage`;
 * each side ignores kinds it does not handle.
 */
export const requestMessage = z.object({
  kind: z.literal('request'),
  id: messageId,
  method: z.string(),
  input: z.unknown(),
})
export const responseMessage = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('result'), id: messageId, value: z.unknown() }),
  z.object({ kind: z.literal('error'), id: messageId, code: z.string(), message: z.string() }),
])
export type RequestMessage = z.infer<typeof requestMessage>
export type ResponseMessage = z.infer<typeof responseMessage>
export type RpcMessage = RequestMessage | ResponseMessage

/** The minimal duplex the rpc library runs over; each transport implements it (SPEC §5.2). */
export interface Channel {
  send(message: RpcMessage): void
  /** Incoming messages are untrusted, so they arrive as `unknown`. Returns a function that removes the listener. */
  onMessage(listener: (message: unknown) => void): () => void
}
