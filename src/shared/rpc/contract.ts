import type { z, ZodType } from 'zod'

/** One contract per host (SPEC §5.2). Members are `rpc`s for now; streams and events become sibling kinds. */
export type Contract = Record<string, { kind: 'rpc'; input: ZodType; result: ZodType }>

export type Handlers<C extends Contract> = {
  [K in keyof C]: (input: z.output<C[K]['input']>) => z.infer<C[K]['result']> | Promise<z.infer<C[K]['result']>>
}
export type Client<C extends Contract> = {
  [K in keyof C]: (input: z.input<C[K]['input']>) => Promise<z.infer<C[K]['result']>>
}

/** A request → response member: the server validates `input` before the handler runs. */
export function rpc<I extends ZodType, R extends ZodType>(schemas: { input: I; result: R }) {
  return { kind: 'rpc' as const, ...schemas }
}

/**
 * The only error that crosses the channel, as its code and message. The library's own codes are `INVALID_INPUT`,
 * `UNKNOWN_METHOD` and `INTERNAL`; contracts add theirs, such as `BRANCH_CHECKED_OUT`.
 */
export class RpcError extends Error {
  constructor(
    readonly code: string,
    message = code,
  ) {
    super(message)
  }
}
