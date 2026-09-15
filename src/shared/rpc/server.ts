import type { z } from 'zod'
import { requestMessage, trySend, type Channel, type RequestMessage } from './channel'
import type { CodedError, Contract, Handlers, Result, RpcFailure } from './contract'

type Response = Result<unknown, CodedError>

const INTERNAL: Result<never, { code: 'INTERNAL' }> = { data: null, error: { code: 'INTERNAL' } }

/**
 * Answers requests on `channel` (SPEC §5.2). Anything that goes wrong reaches the client as a coded error value; an
 * unexpected throw or an off-contract result becomes a bare `INTERNAL`, so no message or stack leaks. Returns a
 * function that stops serving.
 */
export function serve<C extends Contract>(contract: C, handlers: Handlers<C>, channel: Channel): () => void {
  return channel.onMessage(async (message) => {
    const { success, data: request } = requestMessage.safeParse(message)
    if (!success) return
    const response = await respond(contract, handlers as Handlers<Contract>, request)
    const { error } = trySend(channel, { kind: 'response', id: request.id, ...response })
    if (error) trySend(channel, { kind: 'response', id: request.id, ...INTERNAL })
  })
}

async function respond(contract: Contract, handlers: Handlers<Contract>, request: RequestMessage): Promise<Response> {
  const { method, input } = request
  // `hasOwn`, so a peer cannot reach prototype members such as `toString`.
  if (!Object.hasOwn(contract, method)) return failure({ code: 'UNKNOWN_METHOD', method })
  const member = contract[method]!

  const { success, data: parsedInput, error: inputError } = member.input.safeParse(input)
  if (!success) return failure({ code: 'INVALID_INPUT', issues: toIssues(inputError) })

  const { data: outcome, error: thrown } = await runHandler(handlers[method]!, parsedInput)
  if (thrown) return INTERNAL

  if (outcome.error) {
    const { success: isContractError, data: error } = member.error.safeParse(outcome.error)
    if (!isContractError) return INTERNAL
    return { data: null, error }
  }
  const { success: isContractResult, data } = member.result.safeParse(outcome.data)
  if (!isContractResult) return INTERNAL
  return { data, error: null }
}

/** Runs a handler, mapping a throw to `INTERNAL`. Its own result is still unchecked. */
async function runHandler(
  handler: Handlers<Contract>[string],
  input: unknown,
): Promise<Result<Result<unknown, unknown>, { code: 'INTERNAL' }>> {
  try {
    return { data: await handler(input), error: null }
  } catch {
    return INTERNAL
  }
}

function failure(error: RpcFailure): Response {
  return { data: null, error }
}

function toIssues(error: z.ZodError): { path: string[]; message: string }[] {
  return error.issues.map(({ path, message }) => ({ path: path.map(String), message }))
}
