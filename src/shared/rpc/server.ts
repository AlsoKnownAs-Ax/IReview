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
type StreamItems = AsyncIterator<unknown, StreamEnd<unknown>>
type StreamHandler = (input: unknown, signal: AbortSignal) => StreamItems
type StreamMember = Extract<Member, { kind: 'stream' }>
/** A contract member together with the host's handler for it, if the host has one. */
type Method =
  | (Extract<Member, { kind: 'rpc' }> & { handler?: RpcHandler })
  | (StreamMember & { handler?: StreamHandler })
  | Extract<Member, { kind: 'event' }>
type Methods = Map<string, Method>
type StreamMessage = Extract<ClientMessage, { kind: 'stream' }>
type Issue = Extract<RpcFailure, { code: 'INVALID_INPUT' }>['issues'][number]
type Receivers = {
  [K in ClientMessage['kind']]: (message: Extract<ClientMessage, { kind: K }>) => void | Promise<void>
}

export type EmitFailure =
  Extract<RpcFailure, { code: 'UNKNOWN_METHOD' | 'SEND_FAILED' }> | { code: 'INVALID_PAYLOAD'; issues: Issue[] }

export type Server<C extends Contract> = {
  /** Validates `payload`, then sends it to every subscription to `event`. Nothing is sent if validation fails. */
  emit<K extends EventName<C> & string>(event: K, payload: Payload<C[K]>): Result<null, EmitFailure>
  /** Stops serving: subscriptions are dropped, and open streams are cancelled and end with `STOPPED`. */
  stop(): void
}

/**
 * Answers requests, streams and subscriptions on `channel` (SPEC §5.2). Anything that goes wrong reaches the client as
 * a coded error value; an unexpected throw or an off-contract result, item or error becomes a bare `INTERNAL`, so no
 * message or stack leaks.
 */
export function serve<C extends Contract>(contract: C, handlers: Handlers<C>, channel: Channel): Server<C> {
  const methods = toMethods(contract, handlers)
  const streams = new Map<number, AbortController>()
  /** The event each subscription id is subscribed to. */
  const subscriptions = new Map<number, string>()

  /** Ids already in use belong to the open stream or subscription, so a peer reusing one is ignored. */
  function inUse(id: number): boolean {
    return streams.has(id) || subscriptions.has(id)
  }

  /** Once a stream is cancelled, nothing further is sent for it. */
  async function runStream(message: StreamMessage): Promise<void> {
    if (inUse(message.id)) return
    const controller = new AbortController()
    streams.set(message.id, controller)
    const { error } = await pumpSafely(message, controller.signal)
    if (controller.signal.aborted) return
    streams.delete(message.id)
    channel.send({ kind: 'end', id: message.id, error })
  }

  /** Like `respondSafely`, for a stream: a throw while it runs ends it with `INTERNAL`. */
  async function pumpSafely(message: StreamMessage, signal: AbortSignal): Promise<RpcResult> {
    try {
      return await pump(message, signal)
    } catch {
      return failure({ code: 'INTERNAL' })
    }
  }

  async function pump({ id, method, input }: StreamMessage, signal: AbortSignal): Promise<RpcResult> {
    const target = methods.get(method)
    if (target?.kind !== 'stream' || !target.handler) return failure({ code: 'UNKNOWN_METHOD', method })

    const { data: parsedInput, error } = parseInput(target, input)
    if (error) return failure(error)

    const items = target.handler(parsedInput, signal)
    const end = await sendItems(target, items, id, signal)
    // Closes a handler that stopped early, even one that ignores `signal`; harmless once it has finished.
    await items.return?.()
    return end
  }

  /** Sends each item the handler yields until it finishes or `signal` aborts, then resolves to how it ended. */
  async function sendItems(
    member: StreamMember,
    items: StreamItems,
    id: number,
    signal: AbortSignal,
  ): Promise<RpcResult> {
    for (;;) {
      const step = await items.next()
      // What a cancelled stream resolves to is never sent.
      if (signal.aborted) return { data: null, error: null }
      if (step.done) return toStreamEnd(member, step.value)
      const { success, data: item } = member.item.safeParse(step.value)
      if (!success) return failure({ code: 'INTERNAL' })
      const { error } = channel.send({ kind: 'item', id, data: item })
      if (error) return failure({ code: 'INTERNAL' })
    }
  }

  const receivers: Receivers = {
    request: async ({ id, ...request }): Promise<void> => {
      const { error } = channel.send({ kind: 'response', id, ...(await respondSafely(methods, request)) })
      if (error) channel.send({ kind: 'response', id, ...failure({ code: 'INTERNAL' }) })
    },
    stream: runStream,
    subscribe: ({ id, event }): void => {
      if (inUse(id)) return
      if (methods.get(event)?.kind !== 'event') {
        channel.send({ kind: 'response', id, ...failure({ code: 'UNKNOWN_METHOD', method: event }) })
        return
      }
      subscriptions.set(id, event)
      channel.send({ kind: 'response', id, data: null, error: null })
    },
    cancel: ({ id }): void => {
      streams.get(id)?.abort()
      streams.delete(id)
      subscriptions.delete(id)
    },
  }

  const stopListening = channel.onMessage((raw): void => {
    const { success, data: message } = clientMessage.safeParse(raw)
    if (!success) return
    // Each receiver takes its own kind of message, which TypeScript cannot correlate through the lookup.
    const receive = receivers[message.kind] as (message: ClientMessage) => void | Promise<void>
    receive(message)
  })

  return {
    emit: (event: string, payload: unknown): Result<null, EmitFailure> => {
      const target = methods.get(event)
      if (target?.kind !== 'event') return { data: null, error: { code: 'UNKNOWN_METHOD', method: event } }

      const { success, data: parsedPayload, error } = target.payload.safeParse(payload)
      if (!success) return { data: null, error: { code: 'INVALID_PAYLOAD', issues: error.issues.map(toIssue) } }

      const [sendFailure] = [...subscriptions]
        .filter(([, subscribed]) => subscribed === event)
        .map(([id]) => channel.send({ kind: 'event', id, payload: parsedPayload }))
        .flatMap((sent) => sent.error ?? [])
      if (sendFailure) return { data: null, error: sendFailure }
      return { data: null, error: null }
    },
    stop: (): void => {
      stopListening()
      subscriptions.clear()
      streams.forEach((controller, id) => {
        controller.abort()
        channel.send({ kind: 'end', id, error: { code: 'STOPPED' } })
      })
      streams.clear()
    },
  }
}

function toMethods<C extends Contract>(contract: C, handlers: Handlers<C>): Methods {
  const handlerFor = new Map(Object.entries(handlers))
  const entries = Object.entries(contract).map(([name, member]) => [name, { ...member, handler: handlerFor.get(name) }])
  return new Map(entries as [string, Method][])
}

/** The one place a request's throw is caught: from a handler, a schema refinement or a handler that breaks its types. */
async function respondSafely(methods: Methods, request: Omit<RequestMessage, 'id'>): Promise<RpcResult> {
  try {
    return await respond(methods, request)
  } catch {
    return failure({ code: 'INTERNAL' })
  }
}

async function respond(methods: Methods, { method, input }: Omit<RequestMessage, 'id'>): Promise<RpcResult> {
  const target = methods.get(method)
  if (target?.kind !== 'rpc' || !target.handler) return failure({ code: 'UNKNOWN_METHOD', method })

  const { data: parsedInput, error } = parseInput(target, input)
  if (error) return failure(error)

  const outcome = await target.handler(parsedInput)
  if (outcome.error) return toContractError(target, outcome.error)
  return toContractResult(target, outcome.data)
}

function parseInput(member: { input: ZodType }, input: unknown): Result<unknown, RpcFailure> {
  const { success, data, error } = member.input.safeParse(input)
  if (!success) return { data: null, error: { code: 'INVALID_INPUT', issues: error.issues.map(toIssue) } }
  return { data, error: null }
}

function toStreamEnd(member: { error: ZodType<CodedError> }, end: StreamEnd<unknown>): RpcResult {
  if (!end?.error) return { data: null, error: null }
  return toContractError(member, end.error)
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
