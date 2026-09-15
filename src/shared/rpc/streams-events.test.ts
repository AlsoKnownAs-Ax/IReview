import { expect, test, vi } from 'vitest'
import { z } from 'zod'
import type { RpcMessage } from './channel'
import { createClient } from './client'
import { event, stream, type Contract, type Handlers } from './contract'
import { createInMemoryChannelPair } from './in-memory-channel'
import { serve } from './server'
import { connect } from './testing'

const contract = {
  count: stream({
    input: z.object({ to: z.number() }),
    item: z.number(),
    error: z.object({ code: z.literal('RATE_LIMITED'), retryAfter: z.number() }),
  }),
  headChanged: event({ payload: z.object({ head: z.string() }) }),
} satisfies Contract

async function collect<T>(items: AsyncIterable<T>): Promise<T[]> {
  const collected: T[] = []
  for await (const item of items) collected.push(item)
  return collected
}

test('a stream yields every item in order and then completes', async () => {
  const { client } = connect(contract, {
    count: async function* ({ to }) {
      for (let n = 1; n <= to; n++) yield n
    },
  })

  expect(await collect(client.count({ to: 3 }))).toEqual([1, 2, 3].map((n) => ({ data: n, error: null })))
})

type SlowCount = { count: Handlers<typeof contract>['count']; signals: AbortSignal[]; closed: () => boolean }

/** Counts a tick apart, ignoring its signal, and records the signal and whether its generator was closed. */
function countSlowly(): SlowCount {
  const signals: AbortSignal[] = []
  let closed = false
  const count: SlowCount['count'] = async function* ({ to }, signal) {
    signals.push(signal)
    try {
      for (let n = 1; n <= to; n++) {
        yield n
        await new Promise((resolve) => setTimeout(resolve, 1))
      }
    } finally {
      closed = true
    }
  }
  return { count, signals, closed: () => closed }
}

/** Waits for the host to cancel and close the handler, then checks it has stayed quiet since. */
async function expectCancelled({ signals, closed }: SlowCount, sent: RpcMessage[]): Promise<void> {
  await expect.poll(() => signals[0]?.aborted && closed()).toBe(true)
  const sentAtCancel = sent.length
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(sent).toHaveLength(sentAtCancel)
}

test('breaking out of iteration cancels the stream on the host, which sends nothing further', async () => {
  const slow = countSlowly()
  const { client, sent } = connect(contract, { count: slow.count })

  for await (const { data } of client.count({ to: 1000 })) if (data === 2) break

  await expectCancelled(slow, sent)
})

test('aborting ends the iteration at once and cancels the stream on the host', async () => {
  const slow = countSlowly()
  const { client, sent } = connect(contract, { count: slow.count })
  const controller = new AbortController()

  const iterating = collect(client.count({ to: 1000 }, controller.signal))
  await expect.poll(() => sent.length).toBeGreaterThan(1)
  controller.abort()

  expect((await iterating).length).toBeGreaterThan(1)
  await expectCancelled(slow, sent)
})

test('stopping the host ends its open streams with STOPPED and cancels them', async () => {
  const slow = countSlowly()
  const { client, server, sent } = connect(contract, { count: slow.count })

  const iterating = collect(client.count({ to: 1000 }))
  await expect.poll(() => sent.length).toBeGreaterThan(1)
  server.stop()

  expect((await iterating).at(-1)).toEqual({ data: null, error: { code: 'STOPPED' } })
  await expectCancelled(slow, sent)
})

test('opening a stream with an id already in use is ignored, so the open stream stays cancellable', async () => {
  const slow = countSlowly()
  const [peer, hostEnd] = createInMemoryChannelPair()
  serve(contract, { count: slow.count }, hostEnd)

  const open = { kind: 'stream', id: 7, method: 'count', input: { to: 1000 } } as const
  peer.send(open)
  peer.send(open)
  await expect.poll(() => slow.signals.length).toBe(1)
  peer.send({ kind: 'cancel', id: 7 })

  await expect.poll(() => slow.signals[0]?.aborted).toBe(true)
  expect(slow.signals).toHaveLength(1)
})

test('input that fails the schema ends the stream with INVALID_INPUT and the handler never runs', async () => {
  const count = vi.fn(async function* () {})
  const { client } = connect(contract, { count })

  // @ts-expect-error -- a peer is not bound by the contract's types
  const results = await collect(client.count({ to: 'three' }))
  expect(results).toEqual([{ data: null, error: { code: 'INVALID_INPUT', issues: [expect.anything()] } }])
  expect(count).not.toHaveBeenCalled()
})

test('a stream handler returning one of its errors ends the stream with that error, after the items before it', async () => {
  const { client } = connect(contract, {
    count: async function* () {
      yield 1
      return { data: null, error: { code: 'RATE_LIMITED', retryAfter: 60 } }
    },
  })

  expect(await collect(client.count({ to: 2 }))).toEqual([
    { data: 1, error: null },
    { data: null, error: { code: 'RATE_LIMITED', retryAfter: 60 } },
  ])
})

test.each([
  [
    'a throw',
    async function* (): AsyncGenerator<number> {
      yield 1
      throw new Error('ENOENT: C:\\secret\\repo')
    },
  ],
  [
    'an item the item schema rejects',
    async function* (): AsyncGenerator<number | string> {
      yield 1
      yield 'two'
    },
  ],
  [
    'an error the error schema rejects',
    async function* (): AsyncGenerator<number, { data: null; error: { code: string } }> {
      yield 1
      return { data: null, error: { code: 'ENOENT' } }
    },
  ],
])('%s from a stream handler ends the stream with a bare INTERNAL', async (_, count) => {
  // @ts-expect-error -- handlers are not bound by the contract's types at runtime
  const { client } = connect(contract, { count })

  expect(await collect(client.count({ to: 2 }))).toEqual([
    { data: 1, error: null },
    { data: null, error: { code: 'INTERNAL' } },
  ])
})

/** Lets every message already sent over the in-memory channel arrive. */
const delivered = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

test('event subscribers receive emitted payloads, and the host sends nothing once they unsubscribe', async () => {
  const { client, server, sent } = connect(contract, { count: async function* () {} })
  const heads: string[] = []

  const { data: unsubscribe } = await client.headChanged(({ head }) => heads.push(head))
  expect(server.emit('headChanged', { head: 'a' })).toEqual({ data: null, error: null })
  await expect.poll(() => heads).toEqual(['a'])
  unsubscribe?.()
  await delivered()
  server.emit('headChanged', { head: 'b' })
  await delivered()

  expect(heads).toEqual(['a'])
  expect(sent.filter(({ kind }) => kind === 'event')).toHaveLength(1)
})

test('subscribing to an event the host does not serve is an UNKNOWN_METHOD error', async () => {
  const [clientEnd, hostEnd] = createInMemoryChannelPair()
  serve(contract, { count: async function* () {} }, hostEnd)
  const newerContract = { ...contract, discarded: event({ payload: z.null() }) }

  const result = await createClient(newerContract, clientEnd).discarded(() => {})
  expect(result).toEqual({ data: null, error: { code: 'UNKNOWN_METHOD', method: 'discarded' } })
})

test('emitting a payload the schema rejects is an error and sends nothing; one the channel cannot carry is SEND_FAILED', async () => {
  const loose = { ...contract, inspected: event({ payload: z.unknown() }) }
  const { client, server, sent } = connect(loose, { count: async function* () {} })
  await client.headChanged(() => {})
  await client.inspected(() => {})

  // @ts-expect-error -- the host is not bound by the contract's types at runtime
  expect(server.emit('headChanged', { head: 42 }).error).toMatchObject({ code: 'INVALID_PAYLOAD' })
  expect(sent.filter(({ kind }) => kind === 'event')).toHaveLength(0)
  expect(server.emit('inspected', () => 'functions cannot be cloned').error).toEqual({ code: 'SEND_FAILED' })
})
