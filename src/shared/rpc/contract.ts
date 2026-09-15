import { z, type ZodType } from 'zod'

export type Result<T, E> = { data: T; error: null } | { data: null; error: E }

/** Any error that crosses the channel: a code plus the context to act on. */
export type CodedError = { code: string }

/** Errors the library itself returns for any call, on top of each member's own. */
export type RpcFailure =
  | { code: 'INVALID_INPUT'; issues: { path: string[]; message: string }[] }
  | { code: 'UNKNOWN_METHOD'; method: string }
  | { code: 'SEND_FAILED' }
  | { code: 'INTERNAL' }

/** A stream can also end because its host stopped serving. */
export type StreamFailure = RpcFailure | { code: 'STOPPED' }

/** What a response carries on the wire, before a client narrows it to a member's types. */
export type RpcResult = Result<unknown, CodedError>

type RpcMember<I extends ZodType, R extends ZodType, E extends ZodType<CodedError>> = {
  kind: 'rpc'
  input: I
  result: R
  error: E
}

type StreamMember<I extends ZodType, T extends ZodType, E extends ZodType<CodedError>> = {
  kind: 'stream'
  input: I
  item: T
  error: E
}

type EventMember<P extends ZodType> = { kind: 'event'; payload: P }

/** One contract per host (SPEC §5.2): a record of `rpc`, `stream` and `event` members. */
export type Contract = Record<
  string,
  | RpcMember<ZodType, ZodType, ZodType<CodedError>>
  | StreamMember<ZodType, ZodType, ZodType<CodedError>>
  | EventMember<ZodType>
>

type Awaitable<T> = T | Promise<T>

/** How a stream handler finishes: by returning nothing to complete, or a `Result` carrying one of its member's errors. */
export type StreamEnd<E> = void | Result<null, E>

type HandlerFor<M> =
  M extends RpcMember<infer I, infer R, infer E>
    ? (input: z.output<I>) => Awaitable<Result<z.input<R>, z.input<E>>>
    : M extends StreamMember<infer I, infer T, infer E>
      ? (input: z.output<I>, signal: AbortSignal) => AsyncIterator<z.input<T>, StreamEnd<z.input<E>>>
      : never

type CallerFor<M> =
  M extends RpcMember<infer I, infer R, infer E>
    ? (input: z.input<I>) => Promise<Result<z.output<R>, z.output<E> | RpcFailure>>
    : M extends StreamMember<infer I, infer T, infer E>
      ? (input: z.input<I>, signal?: AbortSignal) => AsyncIterable<Result<z.output<T>, z.output<E> | StreamFailure>>
      : M extends EventMember<infer P>
        ? (listener: (payload: z.output<P>) => void) => Promise<Result<Unsubscribe, RpcFailure>>
        : never

/** Stops a subscription's listener receiving payloads; calling it again does nothing. */
export type Unsubscribe = () => void

/** The names of a contract's `event` members. */
export type EventName<C extends Contract> = { [K in keyof C]: C[K] extends EventMember<ZodType> ? K : never }[keyof C]

/** What an event member's payload schema accepts. */
export type Payload<M> = M extends EventMember<infer P> ? z.input<P> : never

/**
 * What a host implements for its `rpc` and `stream` members; it emits events through `serve`'s result instead. An `rpc`
 * handler gets parsed input and returns a result or one of the member's own errors. A `stream` handler is an async
 * generator: it yields items and finishes with a `StreamEnd`.
 */
export type Handlers<C extends Contract> = { [K in Exclude<keyof C, EventName<C>>]: HandlerFor<C[K]> }

/**
 * What a caller gets. An `rpc` resolves to the server-parsed result, a member error or an `RpcFailure`. A `stream`
 * yields each item as a `Result`; a failure arrives as a last error `Result`, then the iterable ends. An `event` takes
 * a listener and resolves once the host accepts the subscription.
 */
export type Client<C extends Contract> = { [K in keyof C]: CallerFor<C[K]> }

/**
 * A request → response member. The server validates `input` before the handler runs, and `result` and `error` before
 * sending, which also strips fields the schemas don't declare. Without `error`, the member has no errors of its own.
 */
export function rpc<I extends ZodType, R extends ZodType>(schemas: { input: I; result: R }): RpcMember<I, R, z.ZodNever>
export function rpc<I extends ZodType, R extends ZodType, E extends ZodType<CodedError>>(schemas: {
  input: I
  result: R
  error: E
}): RpcMember<I, R, E>
export function rpc(schemas: {
  input: ZodType
  result: ZodType
  error?: ZodType<CodedError>
}): RpcMember<ZodType, ZodType, ZodType<CodedError>> {
  const { input, result, error = z.never() } = schemas
  return { kind: 'rpc', input, result, error }
}

/**
 * A member whose handler yields items. The server validates `input` before the handler runs, and each item and the
 * final error before sending. Without `error`, the member has no errors of its own.
 */
export function stream<I extends ZodType, T extends ZodType>(schemas: {
  input: I
  item: T
}): StreamMember<I, T, z.ZodNever>
export function stream<I extends ZodType, T extends ZodType, E extends ZodType<CodedError>>(schemas: {
  input: I
  item: T
  error: E
}): StreamMember<I, T, E>
export function stream(schemas: {
  input: ZodType
  item: ZodType
  error?: ZodType<CodedError>
}): StreamMember<ZodType, ZodType, ZodType<CodedError>> {
  const { input, item, error = z.never() } = schemas
  return { kind: 'stream', input, item, error }
}

/** A member the host pushes to subscribed clients. The server validates each `payload` before sending. */
export function event<P extends ZodType>(schemas: { payload: P }): EventMember<P> {
  return { kind: 'event', payload: schemas.payload }
}
