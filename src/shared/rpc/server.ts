import type { z } from 'zod'
import { requestMessage, type Channel, type RequestMessage } from './channel'
import type { Contract, Handlers, RpcFailure, RpcResult } from './contract'

type Member = Contract[string]
type Handler = Handlers<Contract>[string]
type Issue = Extract<RpcFailure, { code: 'INVALID_INPUT' }>['issues'][number]
type Methods = { members: Map<string, Member>; handlers: Map<string, Handler> }

/**
 * Answers requests on `channel` (SPEC §5.2). Anything that goes wrong reaches the client as a coded error value; an
 * unexpected throw or an off-contract result becomes a bare `INTERNAL`, so no message or stack leaks. Returns a
 * function that stops serving.
 */
export function serve<C extends Contract>(contract: C, handlers: Handlers<C>, channel: Channel): () => void {
  const methods: Methods = {
    members: new Map(Object.entries(contract)),
    handlers: new Map(Object.entries(handlers as Handlers<Contract>)),
  }
  return channel.onMessage(async (message): Promise<void> => {
    const { success, data: request } = requestMessage.safeParse(message)
    if (!success) return
    const { error } = channel.send({ kind: 'response', id: request.id, ...(await respondSafely(methods, request)) })
    if (error) channel.send({ kind: 'response', id: request.id, ...failure({ code: 'INTERNAL' }) })
  })
}

/** The one place a throw is caught: from a handler, a schema refinement or a handler that breaks its types. */
async function respondSafely(methods: Methods, request: RequestMessage): Promise<RpcResult> {
  try {
    return await respond(methods, request)
  } catch {
    return failure({ code: 'INTERNAL' })
  }
}

async function respond({ members, handlers }: Methods, { method, input }: RequestMessage): Promise<RpcResult> {
  const member = members.get(method)
  const handler = handlers.get(method)
  if (!member || !handler) return failure({ code: 'UNKNOWN_METHOD', method })

  const { success, data: parsedInput, error } = member.input.safeParse(input)
  if (!success) return failure({ code: 'INVALID_INPUT', issues: error.issues.map(toIssue) })

  const outcome = await handler(parsedInput)
  if (outcome.error) return toContractError(member, outcome.error)
  return toContractResult(member, outcome.data)
}

function toContractError(member: Member, error: unknown): RpcResult {
  const { success, data: contractError } = member.error.safeParse(error)
  if (!success) return failure({ code: 'INTERNAL' })
  return { data: null, error: contractError }
}

function toContractResult(member: Member, data: unknown): RpcResult {
  const { success, data: contractResult } = member.result.safeParse(data)
  if (!success) return failure({ code: 'INTERNAL' })
  return { data: contractResult, error: null }
}

function failure(error: RpcFailure): RpcResult {
  return { data: null, error }
}

function toIssue({ path, message }: z.core.$ZodIssue): Issue {
  return { path: path.map(String), message }
}
