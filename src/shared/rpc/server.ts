import { z } from 'zod'
import { requestMessage, type Channel, type RequestMessage, type ResponseMessage } from './channel'
import { RpcError, type Contract, type Handlers } from './contract'

/**
 * Answers requests on `channel`, validating every input before its handler runs and every result before it is sent
 * (SPEC §5.2). Returns a function that stops serving.
 */
export function serve<C extends Contract>(contract: C, handlers: Handlers<C>, channel: Channel): () => void {
  return channel.onMessage(async (raw) => {
    const request = requestMessage.safeParse(raw)
    if (!request.success) return
    const response = await respond(contract, handlers as Handlers<Contract>, request.data)
    try {
      channel.send(response)
    } catch {
      // The transport could not carry the result, such as a value that cannot be structured-cloned.
      channel.send(internalError(request.data.id))
    }
  })
}

async function respond(
  contract: Contract,
  handlers: Handlers<Contract>,
  request: RequestMessage,
): Promise<ResponseMessage> {
  const { id, method, input } = request
  try {
    // `hasOwn`, so a peer cannot reach prototype members such as `toString`.
    const handler = Object.hasOwn(contract, method) ? handlers[method] : undefined
    if (!handler) throw new RpcError('UNKNOWN_METHOD')
    const { input: inputSchema, result: resultSchema } = contract[method]!
    const parsed = inputSchema.safeParse(input)
    if (!parsed.success) throw new RpcError('INVALID_INPUT', z.prettifyError(parsed.error))
    return { kind: 'result', id, value: resultSchema.parse(await handler(parsed.data)) }
  } catch (error) {
    // Only an RpcError's code and message cross the channel; anything else could carry paths or stack traces.
    return error instanceof RpcError
      ? { kind: 'error', id, code: error.code, message: error.message }
      : internalError(id)
  }
}

function internalError(id: number): ResponseMessage {
  return { kind: 'error', id, code: 'INTERNAL', message: 'Internal error' }
}
