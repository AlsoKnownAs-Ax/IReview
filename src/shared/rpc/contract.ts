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

type RpcMember<I extends ZodType, R extends ZodType, E extends ZodType<CodedError>> = {
  kind: 'rpc'
  input: I
  result: R
  error: E
}

/** One contract per host (SPEC §5.2). Members are `rpc`s for now; streams and events become sibling kinds. */
export type Contract = Record<string, RpcMember<ZodType, ZodType, ZodType<CodedError>>>

type Awaitable<T> = T | Promise<T>

/** What a host implements: each handler gets parsed input and returns a result or one of the member's own errors. */
export type Handlers<C extends Contract> = {
  [K in keyof C]: (input: z.output<C[K]['input']>) => Awaitable<Result<z.input<C[K]['result']>, z.input<C[K]['error']>>>
}

/** What a caller gets: each call resolves to the parsed result, a member error or an `RpcFailure`, and never rejects. */
export type Client<C extends Contract> = {
  [K in keyof C]: (
    input: z.input<C[K]['input']>,
  ) => Promise<Result<z.output<C[K]['result']>, z.output<C[K]['error']> | RpcFailure>>
}

/**
 * A request → response member. The server validates `input` before the handler runs, and `result` and `error` before
 * sending, which also strips fields the schemas don't declare. `error` defaults to none.
 */
export function rpc<I extends ZodType, R extends ZodType, E extends ZodType<CodedError> = z.ZodNever>(schemas: {
  input: I
  result: R
  error?: E
}): RpcMember<I, R, E> {
  // `E` only falls back to `ZodNever` when `error` is omitted, so the default schema matches it.
  const { input, result, error = z.never() as ZodType as E } = schemas
  return { kind: 'rpc', input, result, error }
}
