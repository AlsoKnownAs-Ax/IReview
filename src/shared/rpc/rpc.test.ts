import { expect, expectTypeOf, test, vi } from 'vitest'
import { z } from 'zod'
import type { Channel, RpcMessage } from './channel'
import { createClient } from './client'
import { rpc, type Client, type Contract, type Handlers, type RpcFailure } from './contract'
import { createInMemoryChannelPair } from './in-memory-channel'
import { serve } from './server'

const contract = {
  checkout: rpc({
    input: z.object({ branch: z.string() }),
    result: z.object({ head: z.string() }),
    error: z.object({ code: z.literal('BRANCH_CHECKED_OUT'), branch: z.string() }),
  }),
} satisfies Contract

/** Serves `handlers` and returns a client, plus every message the server put on the wire. */
function connect(handlers: Handlers<typeof contract>): { client: Client<typeof contract>; sent: RpcMessage[] } {
  const [clientEnd, serverEnd] = createInMemoryChannelPair()
  const sent: RpcMessage[] = []
  const recordingEnd: Channel = {
    onMessage: serverEnd.onMessage,
    send(message) {
      sent.push(message)
      serverEnd.send(message)
    },
  }
  serve(contract, handlers, recordingEnd)
  return { client: createClient(contract, clientEnd), sent }
}

test('a call resolves with the handler result', async () => {
  const { client } = connect({ checkout: ({ branch }) => ({ data: { head: `refs/heads/${branch}` }, error: null }) })

  expect(await client.checkout({ branch: 'main' })).toEqual({ data: { head: 'refs/heads/main' }, error: null })
})

test('input that fails the schema is an INVALID_INPUT error and the handler never runs', async () => {
  const checkout = vi.fn(() => ({ data: { head: 'unused' }, error: null }))
  const { client } = connect({ checkout })

  // @ts-expect-error -- a peer is not bound by the contract's types
  const { error } = await client.checkout({ branch: 42 })
  expect(error).toEqual({ code: 'INVALID_INPUT', issues: [{ path: ['branch'], message: expect.any(String) }] })
  expect(checkout).not.toHaveBeenCalled()
})

test('a method the host does not serve is an UNKNOWN_METHOD error', async () => {
  const [clientEnd, serverEnd] = createInMemoryChannelPair()
  serve(contract, { checkout: () => ({ data: { head: 'unused' }, error: null }) }, serverEnd)
  const newerContract = { ...contract, discard: rpc({ input: z.object({}), result: z.null() }) }

  const { error } = await createClient(newerContract, clientEnd).discard({})
  expect(error).toEqual({ code: 'UNKNOWN_METHOD', method: 'discard' })
})

test('concurrent calls each resolve with their own response, even when answered out of order', async () => {
  const delays: Record<string, number> = { a: 30, b: 20, c: 10 }
  const { client } = connect({
    checkout: ({ branch }) =>
      new Promise((resolve) => setTimeout(() => resolve({ data: { head: branch }, error: null }), delays[branch])),
  })

  const results = await Promise.all(['a', 'b', 'c'].map((branch) => client.checkout({ branch })))
  expect(results.map(({ data }) => data)).toEqual([{ head: 'a' }, { head: 'b' }, { head: 'c' }])
})

test("a contract error reaches the client unchanged, minus fields its schema doesn't declare", async () => {
  const error = { code: 'BRANCH_CHECKED_OUT', branch: 'main', stack: 'at C:\\secret\\repo' } as const
  const { client } = connect({ checkout: () => ({ data: null, error }) })

  const result = await client.checkout({ branch: 'main' })
  expectTypeOf(result.error).toEqualTypeOf<{ code: 'BRANCH_CHECKED_OUT'; branch: string } | RpcFailure | null>()
  expect(result).toEqual({ data: null, error: { code: 'BRANCH_CHECKED_OUT', branch: 'main' } })
})

test('an unexpected throw becomes INTERNAL without leaking its message or stack', async () => {
  const { client, sent } = connect({
    checkout: () => {
      throw new Error('ENOENT: C:\\secret\\repo')
    },
  })

  expect(await client.checkout({ branch: 'main' })).toEqual({ data: null, error: { code: 'INTERNAL' } })
  expect(sent).toEqual([{ kind: 'response', id: expect.any(Number), data: null, error: { code: 'INTERNAL' } }])
})

test('a handler result that fails the result schema becomes INTERNAL', async () => {
  // @ts-expect-error -- handlers are not bound by the contract's types at runtime
  const { client } = connect({ checkout: () => ({ data: { head: 42 }, error: null }) })

  expect(await client.checkout({ branch: 'main' })).toEqual({ data: null, error: { code: 'INTERNAL' } })
})

test('a result the channel cannot carry becomes INTERNAL', async () => {
  const [clientEnd, serverEnd] = createInMemoryChannelPair()
  const loose = { inspect: rpc({ input: z.object({}), result: z.unknown() }) }
  serve(loose, { inspect: () => ({ data: () => 'functions cannot be cloned', error: null }) }, serverEnd)

  expect(await createClient(loose, clientEnd).inspect({})).toEqual({ data: null, error: { code: 'INTERNAL' } })
})

test('input the channel cannot carry is a SEND_FAILED error', async () => {
  const { client } = connect({ checkout: ({ branch }) => ({ data: { head: branch }, error: null }) })
  const input = { branch: 'main', onDone: () => {} }

  expect(await client.checkout(input)).toEqual({ data: null, error: { code: 'SEND_FAILED' } })
  expect(await client.checkout({ branch: 'next' })).toEqual({ data: { head: 'next' }, error: null })
})
