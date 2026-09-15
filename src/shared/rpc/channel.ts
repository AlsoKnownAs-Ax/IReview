import { z } from 'zod'

const id = z.number()

/** The wire envelope. `id` pairs a response with its request; streams and events add `kind`s the other side ignores. */
export const requestMessage = z.object({ kind: z.literal('request'), id, method: z.string(), input: z.unknown() })
export const responseMessage = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('result'), id, value: z.unknown() }),
  z.object({ kind: z.literal('error'), id, code: z.string(), message: z.string() }),
])
export type RequestMessage = z.infer<typeof requestMessage>
export type ResponseMessage = z.infer<typeof responseMessage>

/** The minimal duplex the rpc library runs over; each transport implements it (SPEC §5.2). */
export interface Channel {
  send(message: RequestMessage | ResponseMessage): void
  /** Incoming messages are untrusted, so they arrive as `unknown`. Returns a function that removes the listener. */
  onMessage(listener: (message: unknown) => void): () => void
}
