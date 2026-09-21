import { isDefinedError } from '@orpc/client'
import { eventIterator, oc } from '@orpc/contract'
import { EventPublisher, implement, type Router } from '@orpc/server'
import { assert, beforeEach, expect, expectTypeOf, onTestFinished, test, vi } from 'vitest'
import { z } from 'zod'
import { connect, declaredError, serve, type Client } from './rpc'

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
  repo: { head: oc.output(z.string()) },
  discard: oc
    .input(z.object({ path: z.string() }))
    .errors({ DIRTY_WORKTREE: { data: z.object({ code: z.literal('DIRTY_WORKTREE'), path: z.string() }) } }),
}
const os = implement(contract)
const logged = vi.spyOn(console, 'error').mockImplementation(() => {})

type TestPort = InstanceType<typeof MessageChannel>['port1']
type HostRouter = Router<typeof contract, Record<never, never>>
type Channel = { client: Client<typeof contract>; clientPort: TestPort; hostPort: TestPort }
type EndlessLogHost = { cancelled: boolean; yielded: number }

beforeEach(() => logged.mockClear())

/** Serves `router` on one end of a fresh MessageChannel and connects a client to the other. */
function openChannel(router: Partial<HostRouter>): Channel {
  const { port1: clientPort, port2: hostPort } = new MessageChannel()
  onTestFinished(() => clientPort.close())
  // Each test implements only what it calls; anything else answers NOT_FOUND.
  serve<typeof contract>(router as HostRouter, hostPort)
  return { client: connect<typeof contract>(clientPort), clientPort, hostPort }
}

function connectTo(router: Partial<HostRouter>): Client<typeof contract> {
  return openChannel(router).client
}

/** Serves a `log` that yields until the host cancels it. */
function connectEndlessLog(): { client: Client<typeof contract>; host: EndlessLogHost } {
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

test('a client, and each nested client, can be handed over through a Promise', async () => {
  const client = connectTo({
    checkout: os.checkout.handler(() => ({ head: 'refs/heads/main' })),
    repo: { head: os.repo.head.handler(() => 'main') },
  })

  const [root, repo] = await Promise.all([Promise.resolve(client), Promise.resolve(client.repo)])
  const [checkout, head] = await Promise.all([root.checkout({ branch: 'main' }), repo.head()])
  expect([checkout.data, head.data]).toEqual([{ head: 'refs/heads/main' }, 'main'])
})

test('serve takes only a router for the whole contract it names', () => {
  const partial = { checkout: os.checkout.handler(() => ({ head: 'refs/heads/main' })) }

  expectTypeOf(partial).not.toExtend<Parameters<typeof serve<typeof contract>>[0]>()
})

test('a message that is not an oRPC request is dropped and logged, and the host keeps answering', async () => {
  const { client, clientPort } = openChannel({ checkout: os.checkout.handler(({ input }) => ({ head: input.branch })) })
  const multipart = { i: 1, p: { u: '/checkout', h: { 'content-type': 'multipart/form-data' } } }
  ;['not json', { i: 0 }, JSON.stringify(multipart)].forEach((message) => clientPort.postMessage(message))

  const { data } = await client.checkout({ branch: 'main' })
  expect(data).toEqual({ head: 'main' })
  expect(logged.mock.calls.filter(([line]) => String(line).includes('dropped'))).toHaveLength(3)
})

test('once the port closes, a call in flight and every later call settle with an error instead of hanging', async () => {
  const { client, hostPort } = openChannel({ checkout: os.checkout.handler(() => new Promise<never>(() => {})) })
  const inFlight = client.checkout({ branch: 'main' })
  await sleep(10)

  hostPort.close()
  expect((await inFlight).error).toBeInstanceOf(Error)
  expect((await client.checkout({ branch: 'next' })).error).toMatchObject({ code: 'SERVICE_UNAVAILABLE' })
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
  expect(logged).not.toHaveBeenCalled()
})

test('declaredError turns a Result error into its declared code, carrying the error as data', async () => {
  const client = connectTo({
    discard: os.discard.handler(({ input, errors }) => {
      // @ts-expect-error -- only codes the procedure declares; this call only checks types, its error is discarded
      declaredError(errors, { code: 'BRANCH_CHECKED_OUT', branch: 'main' })
      throw declaredError(errors, { code: 'DIRTY_WORKTREE', path: input.path })
    }),
  })

  const { error } = await client.discard({ path: 'a.ts' })
  assert(isDefinedError(error))
  expect([error.code, error.data]).toEqual(['DIRTY_WORKTREE', { code: 'DIRTY_WORKTREE', path: 'a.ts' }])
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
  expect(logged).toHaveBeenCalledWith('rpc: a call failed', expect.any(Error))
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
