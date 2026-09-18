import { isDefinedError } from '@orpc/client'
import { eventIterator, oc } from '@orpc/contract'
import { EventPublisher, implement } from '@orpc/server'
import { assert, expect, expectTypeOf, onTestFinished, test, vi } from 'vitest'
import { z } from 'zod'
import { connect, serve } from './rpc'

const contract = {
  checkout: oc
    .input(z.object({ branch: z.string() }))
    .output(z.object({ head: z.string() }))
    .errors({ BRANCH_CHECKED_OUT: { data: z.object({ branch: z.string() }) } }),
  log: oc
    .input(z.object({ count: z.number() }))
    .output(eventIterator(z.string()))
    .errors({ LOG_UNAVAILABLE: {} }),
  changed: oc.output(eventIterator(z.object({ path: z.string() }))),
}
const os = implement(contract)

type Client = ReturnType<typeof connect<typeof contract>>
type EndlessLogHost = { cancelled: boolean; yielded: number }

/** Serves `router` on one end of a fresh MessageChannel and returns a client on the other. */
function connectTo(router: Parameters<typeof serve>[0]): Client {
  const { port1, port2 } = new MessageChannel()
  onTestFinished(() => port1.close())
  serve(router, port2)
  return connect<typeof contract>(port1)
}

/** Serves a `log` that yields until the host cancels it. */
function connectEndlessLog(): { client: Client; host: EndlessLogHost } {
  const host: EndlessLogHost = { cancelled: false, yielded: 0 }
  const client = connectTo({
    log: os.log.handler(async function* ({ signal }) {
      signal?.addEventListener('abort', () => (host.cancelled = true))
      while (!signal?.aborted) {
        yield `commit ${host.yielded++}`
        await sleep(5)
      }
    }),
  })
  return { client, host }
}

async function expectCancelled(host: EndlessLogHost): Promise<void> {
  await vi.waitFor(() => expect(host.cancelled).toBe(true))
  const yielded = host.yielded
  await sleep(30)
  expect(host.yielded).toBe(yielded)
}

async function collect<T>(items: AsyncIterable<T>, into: T[]): Promise<void> {
  for await (const item of items) into.push(item)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

test('a call resolves with the handler result', async () => {
  const client = connectTo({ checkout: os.checkout.handler(({ input }) => ({ head: `refs/heads/${input.branch}` })) })

  const { error, data } = await client.checkout({ branch: 'main' })
  expect({ error, data }).toEqual({ error: null, data: { head: 'refs/heads/main' } })
})

test('input that fails the schema is a BAD_REQUEST with its issues, and the handler never runs', async () => {
  const checkout = vi.fn(() => ({ head: 'unused' }))
  const client = connectTo({ checkout: os.checkout.handler(checkout) })

  // @ts-expect-error -- a peer is not bound by the contract's types
  const { error } = await client.checkout({ branch: 42 })
  expect(error).toMatchObject({
    code: 'BAD_REQUEST',
    data: { issues: [expect.objectContaining({ path: ['branch'] })] },
  })
  expect(checkout).not.toHaveBeenCalled()
})

test("a declared error reaches the client typed, minus fields its schema doesn't declare", async () => {
  const leaky = { branch: 'main', stack: 'at C:\\secret\\repo' }
  const client = connectTo({
    checkout: os.checkout.handler(({ errors }) => {
      throw errors.BRANCH_CHECKED_OUT({ data: leaky })
    }),
  })

  const { error } = await client.checkout({ branch: 'main' })
  assert(isDefinedError(error))
  expectTypeOf(error.data).toEqualTypeOf<{ branch: string }>()
  expect([error.code, error.data]).toEqual(['BRANCH_CHECKED_OUT', { branch: 'main' }])
})

test.each([
  [
    'a throw',
    (): never => {
      throw new Error('ENOENT: C:\\secret\\repo')
    },
  ],
  ['a result the output schema rejects', (): { head: number } => ({ head: 42 })],
])('%s becomes INTERNAL_SERVER_ERROR without leaking anything', async (_, checkout) => {
  // @ts-expect-error -- handlers are not bound by the contract's types at runtime
  const client = connectTo({ checkout: os.checkout.handler(checkout) })

  const { error } = await client.checkout({ branch: 'main' })
  expect(error).toMatchObject({ code: 'INTERNAL_SERVER_ERROR', data: undefined })
  expect(JSON.stringify(error)).not.toContain('secret')
})

test('concurrent calls each resolve with their own response, even when answered out of order', async () => {
  const delays: Record<string, number> = { a: 30, b: 20, c: 10 }
  const client = connectTo({
    checkout: os.checkout.handler(({ input }) => sleep(delays[input.branch] ?? 0).then(() => ({ head: input.branch }))),
  })

  const results = await Promise.all(['a', 'b', 'c'].map((branch) => client.checkout({ branch })))
  expect(results.map(({ data }) => data)).toEqual([{ head: 'a' }, { head: 'b' }, { head: 'c' }])
})

test('a stream yields every item in order and then completes', async () => {
  const client = connectTo({
    log: os.log.handler(async function* ({ input }) {
      yield* Array.from({ length: input.count }, (_, n) => `commit ${n}`)
    }),
  })

  const { data: log } = await client.log({ count: 3 })
  assert(log)
  const items: string[] = []
  await collect(log, items)
  expect(items).toEqual(['commit 0', 'commit 1', 'commit 2'])
})

test('breaking out of a stream cancels it on the host, which yields nothing more', async () => {
  const { client, host } = connectEndlessLog()

  const { data: log } = await client.log({ count: 0 })
  assert(log)
  for await (const item of log) if (item === 'commit 1') break
  await expectCancelled(host)
})

test('aborting a stream ends the iteration and cancels it on the host', async () => {
  const { client, host } = connectEndlessLog()
  const controller = new AbortController()

  const { data: log } = await client.log({ count: 0 }, { signal: controller.signal })
  assert(log)
  const items: string[] = []
  const iterating = collect(log, items)
  await vi.waitFor(() => expect(items).not.toHaveLength(0))
  controller.abort()
  await expect(iterating).rejects.toThrow()
  await expectCancelled(host)
})

test('a declared error thrown by a stream handler ends the iteration with that code', async () => {
  const client = connectTo({
    log: os.log.handler(async function* ({ errors }) {
      yield 'commit 0'
      throw errors.LOG_UNAVAILABLE()
    }),
  })

  const { data: log } = await client.log({ count: 1 })
  assert(log)
  const items: string[] = []
  await expect(collect(log, items)).rejects.toMatchObject({ defined: true, code: 'LOG_UNAVAILABLE' })
  expect(items).toEqual(['commit 0'])
})

test('stream input that fails the schema is a BAD_REQUEST, and the handler never runs', async () => {
  const log = vi.fn(async function* (): AsyncGenerator<string> {})
  const client = connectTo({ log: os.log.handler(log) })

  // @ts-expect-error -- a peer is not bound by the contract's types
  const { error } = await client.log({ count: 'three' })
  expect(error).toMatchObject({ code: 'BAD_REQUEST' })
  expect(log).not.toHaveBeenCalled()
})

test('event subscribers receive published payloads, and the host stops delivering after they unsubscribe', async () => {
  const publisher = new EventPublisher<{ changed: { path: string } }>()
  const client = connectTo({ changed: os.changed.handler(({ signal }) => publisher.subscribe('changed', { signal })) })

  const { data: changes } = await client.changed()
  assert(changes)
  const paths: string[] = []
  const consumed = (async (): Promise<void> => {
    for await (const { path } of changes) {
      paths.push(path)
      if (paths.length === 2) break
    }
  })()
  await vi.waitFor(() => expect(publisher.size).toBe(1))
  ;['a.ts', 'b.ts'].forEach((path) => publisher.publish('changed', { path }))
  await consumed
  await vi.waitFor(() => expect(publisher.size).toBe(0))
  expect(paths).toEqual(['a.ts', 'b.ts'])
})
