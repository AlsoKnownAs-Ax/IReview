import type { z, ZodType } from 'zod'
import { clientMessage, type Channel, type ClientMessage, type RequestMessage } from './channel'
import type {
  CodedError,
  Contract,
  EventName,
  Handlers,
  Payload,
  Result,
  RpcFailure,
  RpcResult,
  StreamEnd,
} from './contract'

type Member = Contract[string]
type RpcHandler = (input: unknown) => RpcResult | Promise<RpcResult>
type StreamHandler = (input: unknown, signal: AbortSignal) => AsyncIterator<unknown, StreamEnd<unknown>>
/** A contract member together with the host's handler for it; events have none. */
type ServedMember =
  | (Extract<Member, { kind: 'rpc' }> & { handler?: RpcHandler })
  | (Extract<Member, { kind: 'stream' }> & { handler?: StreamHandler })
  | Extract<Member, { kind: 'event' }>
type ServedMembers = Map<string, ServedMember>
type StreamMessage = Extract<ClientMessage, { kind: 'stream' }>
type Issue = Extract<RpcFailure, { code: 'INVALID_INPUT' }>['issues'][number]
type Receivers = {
  [K in ClientMessage['kind']]: (message: Extract<ClientMessage, { kind: K }>) => void | Promise<void>
}

export type EmitFailure =
  | Extract<RpcFailure, { code: 'UNKNOWN_METHOD' | 'SEND_FAILED' | 'INTERNAL' }>
  | { code: 'INVALID_PAYLOAD'; issues: Issue[] }

export type Server<C extends Contract> = {
  /** Validates `payload`, then sends it to every subscription to `event`. Nothing is sent if validation fails. */
  emit<K extends EventName<C> & string>(event: K, payload: Payload<C[K]>): Result<null, EmitFailure>
  /** Stops serving: subscriptions are dropped, and open streams are cancelled and end with `STOPPED`. */
  stop(): void
}

/**
 * Answers requests, streams and subscriptions on `channel` (SPEC §5.2). Anything that goes wrong reaches the client as
 * a coded error value; an unexpected throw or an off-contract result, item or error becomes a bare `INTERNAL`, so no
 * message or stack leaks. A stream sends an `item` per value and then settles with a `response`, as a request does.
 */
export function serve<C extends Contract>(contract: C, handlers: Handlers<C>, channel: Channel): Server<C> {
  const members = toServedMembers(contract, handlers)
  const streams = new Map<number, AbortController>()
  /** The event each subscription id is subscribed to. */
  const subscriptions = new Map<number, string>()

  /** An id in use belongs to its open stream or subscription, so a peer reusing it is ignored. */
  function isOpen(id: number): boolean {
    return streams.has(id) || subscriptions.has(id)
  }

  /** Sends the `response` that settles `id`; one the transport cannot carry becomes a bare `INTERNAL`. */
  function settle(id: number, result: RpcResult): void {
    const { error } = channel.send({ kind: 'response', id, ...result })
    if (error) channel.send({ kind: 'response', id, ...failure({ code: 'INTERNAL' }) })
  }

  async function runStream(message: StreamMessage): Promise<void> {
    if (isOpen(message.id)) return
    const controller = new AbortController()
    streams.set(message.id, controller)
    const result = await safely(() => pump(message, controller.signal))
    // A cancelled stream sends nothing further.
    if (controller.signal.aborted) return
    streams.delete(message.id)
    settle(message.id, result)
  }

  /** Sends each item the handler yields until it finishes or `signal` aborts, then resolves to how it ended. */
  async function pump({ id, method, input }: StreamMessage, signal: AbortSignal): Promise<RpcResult> {
    const member = members.get(method)
    if (member?.kind !== 'stream' || !member.handler) return failure({ code: 'UNKNOWN_METHOD', method })

    const { data: parsedInput, error } = parseInput(member, input)
    if (error) return failure(error)

    const items = member.handler(parsedInput, signal)
    try {
      for (;;) {
        const step = await items.next()
        // What a cancelled stream resolves to is never sent.
        if (signal.aborted) return { data: null, error: null }
        if (step.done) return toStreamEnd(member, step.value)
        const { success, data: item } = member.item.safeParse(step.value)
        if (!success) return failure({ code: 'INTERNAL' })
        const { error: sendFailure } = channel.send({ kind: 'item', id, data: item })
        if (sendFailure) return failure({ code: 'INTERNAL' })
      }
    } finally {
      // Closes a handler that stopped early, even one that ignores `signal`; harmless once it has finished.
      await items.return?.()
    }
  }

  function emitSafely(event: string, payload: unknown): Result<null, EmitFailure> {
    try {
      return emit(event, payload)
    } catch {
      // A payload schema's refinement or transform threw.
      return { data: null, error: { code: 'INTERNAL' } }
    }
  }

  function emit(event: string, payload: unknown): Result<null, EmitFailure> {
    const member = members.get(event)
    if (member?.kind !== 'event') return { data: null, error: { code: 'UNKNOWN_METHOD', method: event } }

    const { success, data: parsedPayload, error } = member.payload.safeParse(payload)
    if (!success) return { data: null, error: { code: 'INVALID_PAYLOAD', issues: error.issues.map(toIssue) } }

    const failedSend = [...subscriptions]
      .filter(([, subscribed]): boolean => subscribed === event)
      .map(([id]): ReturnType<Channel['send']> => channel.send({ kind: 'event', id, payload: parsedPayload }))
      .find((sent): boolean => sent.error !== null)
    if (failedSend) return { data: null, error: { code: 'SEND_FAILED' } }
    return { data: null, error: null }
  }

  const receivers = {
    request: async ({ id, ...request }): Promise<void> => settle(id, await safely(() => answer(members, request))),
    stream: runStream,
    subscribe: ({ id, event }): void => {
      if (isOpen(id)) return
      if (members.get(event)?.kind !== 'event') return settle(id, failure({ code: 'UNKNOWN_METHOD', method: event }))
      subscriptions.set(id, event)
      settle(id, { data: null, error: null })
    },
    cancel: ({ id }): void => {
      streams.get(id)?.abort()
      streams.delete(id)
      subscriptions.delete(id)
    },
  } satisfies Receivers

  const stopListening = channel.onMessage((raw): void => {
    const { success, data: message } = clientMessage.safeParse(raw)
    if (!success) return
    // Each receiver takes its own kind of message, which TypeScript cannot correlate through the lookup.
    const receive = receivers[message.kind] as (message: ClientMessage) => void | Promise<void>
    receive(message)
  })

  return {
    emit: emitSafely,
    stop: (): void => {
      stopListening()
      subscriptions.clear()
      streams.forEach((controller, id): void => {
        controller.abort()
        settle(id, { data: null, error: { code: 'STOPPED' } })
      })
      streams.clear()
    },
  }
}

function toServedMembers<C extends Contract>(contract: C, handlers: Handlers<C>): ServedMembers {
  const handlerFor = new Map(Object.entries(handlers))
  const entries = Object.entries(contract).map(([name, member]): [string, unknown] => [
    name,
    { ...member, handler: handlerFor.get(name) },
  ])
  return new Map(entries as [string, ServedMember][])
}

/** The one place a handler's throw is caught: from a handler, a schema refinement or a handler that breaks its types. */
async function safely(run: () => Promise<RpcResult>): Promise<RpcResult> {
  try {
    return await run()
  } catch {
    return failure({ code: 'INTERNAL' })
  }
}

async function answer(members: ServedMembers, { method, input }: Omit<RequestMessage, 'id'>): Promise<RpcResult> {
  const member = members.get(method)
  if (member?.kind !== 'rpc' || !member.handler) return failure({ code: 'UNKNOWN_METHOD', method })

  const { data: parsedInput, error } = parseInput(member, input)
  if (error) return failure(error)

  const outcome = await member.handler(parsedInput)
  if (outcome.error) return toContractError(member, outcome.error)
  return toContractResult(member, outcome.data)
}

function parseInput(member: { input: ZodType }, input: unknown): Result<unknown, RpcFailure> {
  const { success, data, error } = member.input.safeParse(input)
  if (!success) return { data: null, error: { code: 'INVALID_INPUT', issues: error.issues.map(toIssue) } }
  return { data, error: null }
}

/** A stream completes by returning nothing or an empty `Result`; anything else that isn't a member error is `INTERNAL`. */
function toStreamEnd(member: { error: ZodType<CodedError> }, end: StreamEnd<unknown>): RpcResult {
  if (end === undefined) return { data: null, error: null }
  if (end.error) return toContractError(member, end.error)
  if (end.data !== null) return failure({ code: 'INTERNAL' })
  return { data: null, error: null }
}

function toContractError(member: { error: ZodType<CodedError> }, error: unknown): RpcResult {
  const { success, data: contractError } = member.error.safeParse(error)
  if (!success) return failure({ code: 'INTERNAL' })
  return { data: null, error: contractError }
}

function toContractResult(member: { result: ZodType }, data: unknown): RpcResult {
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
