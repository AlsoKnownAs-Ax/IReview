import { expect, test, vi } from 'vitest'
import { z } from 'zod'
import { createClient } from './client'
import type { Channel } from './channel'
import { rpc, RpcError, type Contract, type Handlers } from './contract'
import { createInMemoryChannelPair } from './in-memory-channel'
import { serve } from './server'

const contract = {
  checkout: rpc({ input: z.object({ branch: z.string() }), result: z.object({ head: z.string() }) }),
} satisfies Contract

/** Serves `handlers` and returns a client, plus every message the server put on the wire. */
function connect(handlers: Handlers<typeof contract>) {
  const [clientEnd, serverEnd] = createInMemoryChannelPair()
  const sent: Parameters<Channel['send']>[0][] = []
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
  const { client } = connect({ checkout: ({ branch }) => ({ head: `refs/heads/${branch}` }) })

  await expect(client.checkout({ branch: 'main' })).resolves.toEqual({ head: 'refs/heads/main' })
})

test('input that fails the schema is rejected before the handler runs', async () => {
  const checkout = vi.fn(() => ({ head: 'unused' }))
  const { client } = connect({ checkout })

  // @ts-expect-error -- a peer is not bound by the contract's types
  await expect(client.checkout({ branch: 42 })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  expect(checkout).not.toHaveBeenCalled()
})

test('a method the host does not serve is rejected', async () => {
  const [clientEnd, serverEnd] = createInMemoryChannelPair()
  serve(contract, { checkout: () => ({ head: 'unused' }) }, serverEnd)
  const newer = { ...contract, discard: rpc({ input: z.object({}), result: z.null() }) }

  await expect(createClient(newer, clientEnd).discard({})).rejects.toMatchObject({ code: 'UNKNOWN_METHOD' })
})

test('concurrent calls each resolve with their own response, even when answered out of order', async () => {
  const delays: Record<string, number> = { a: 30, b: 20, c: 10 }
  const { client } = connect({
    checkout: ({ branch }) => new Promise((resolve) => setTimeout(() => resolve({ head: branch }), delays[branch])),
  })

  const heads = await Promise.all(['a', 'b', 'c'].map((branch) => client.checkout({ branch })))
  expect(heads).toEqual([{ head: 'a' }, { head: 'b' }, { head: 'c' }])
})

test('a typed error reaches the client with its code', async () => {
  const { client } = connect({
    checkout: () => {
      throw new RpcError('BRANCH_CHECKED_OUT', 'main is checked out in another worktree')
    },
  })

  const error = await client.checkout({ branch: 'main' }).catch((caught: unknown) => caught)
  expect(error).toBeInstanceOf(RpcError)
  expect(error).toMatchObject({ code: 'BRANCH_CHECKED_OUT', message: 'main is checked out in another worktree' })
})

test('an unexpected error becomes INTERNAL without leaking its message or stack', async () => {
  const { client, sent } = connect({
    checkout: () => {
      throw new Error('ENOENT: C:\\secret\\repo')
    },
  })

  await expect(client.checkout({ branch: 'main' })).rejects.toMatchObject({ code: 'INTERNAL' })
  expect(sent).toEqual([{ kind: 'error', id: expect.any(Number), code: 'INTERNAL', message: 'Internal error' }])
})
