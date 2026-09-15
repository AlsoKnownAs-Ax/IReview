import { z } from 'zod'
import { requestMessage, type Channel, type RequestMessage, type ResponseMessage } from './channel'
import { RpcError, type Contract, type Handlers } from './contract'

/** Answers requests on `channel`, validating every input before its handler runs. Returns a function that stops. */
export function serve<C extends Contract>(contract: C, handlers: Handlers<C>, channel: Channel): () => void {
  return channel.onMessage(async (raw) => {
    const request = requestMessage.safeParse(raw)
    if (request.success) channel.send(await respond(contract, handlers as Handlers<Contract>, request.data))
  })
}

async function respond(contract: Contract, handlers: Handlers<Contract>, { id, method, input }: RequestMessage) {
  try {
    // `hasOwn`, so a peer cannot reach prototype members such as `toString`.
    const handler = Object.hasOwn(contract, method) ? handlers[method] : undefined
    if (!handler) throw new RpcError('UNKNOWN_METHOD')
    const parsed = contract[method]!.input.safeParse(input)
    if (!parsed.success) throw new RpcError('INVALID_INPUT', z.prettifyError(parsed.error))
    return { kind: 'result', id, value: await handler(parsed.data) } satisfies ResponseMessage
  } catch (error) {
    // Only an RpcError's code and message cross the channel; anything else could carry paths or stack traces.
    const { code, message } = error instanceof RpcError ? error : new RpcError('INTERNAL', 'Internal error')
    return { kind: 'error', id, code, message } satisfies ResponseMessage
  }
}
