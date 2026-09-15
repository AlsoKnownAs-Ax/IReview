import { expect, test } from 'vitest'
import { z } from 'zod'
import { createClient } from './client'
import { rpc } from './contract'
import { createMessagePortMainChannel, type MainMessagePort } from './message-port-main-channel'
import { serve } from './server'

type Listener = (event: { data: unknown }) => void
type FakeEnd = { listeners: Set<Listener>; queue: unknown[]; started: boolean }

const contract = { echo: rpc({ input: z.string(), result: z.string() }) }

/** A fake Electron `MessageChannelMain`: cloned, asynchronous delivery that is queued until the receiver starts. */
function fakeMessageChannelMain(): [MainMessagePort, MainMessagePort] {
  const flush = (end: FakeEnd): void => {
    if (!end.started) return
    end.queue.splice(0).forEach((data) => end.listeners.forEach((listener) => listener({ data })))
  }
  const port = (own: FakeEnd, peer: FakeEnd): MainMessagePort => ({
    postMessage(message) {
      peer.queue.push(structuredClone(message))
      queueMicrotask(() => flush(peer))
    },
    on: (_, listener) => own.listeners.add(listener),
    off: (_, listener) => own.listeners.delete(listener),
    start() {
      own.started = true
      flush(own)
    },
  })
  const [a, b]: FakeEnd[] = [0, 1].map(() => ({ listeners: new Set(), queue: [], started: false }))
  return [port(a!, b!), port(b!, a!)]
}

test('a call and its response cross a MessageChannelMain', async () => {
  const [clientPort, hostPort] = fakeMessageChannelMain()
  serve(contract, { echo: (text) => `echo: ${text}` }, createMessagePortMainChannel(hostPort))
  const client = createClient(contract, createMessagePortMainChannel(clientPort))

  await expect(client.echo('hello')).resolves.toBe('echo: hello')
})

test('a removed listener receives nothing more', async () => {
  const [peer, port] = fakeMessageChannelMain()
  const received: unknown[] = []
  const stop = createMessagePortMainChannel(port).onMessage((message) => received.push(message))

  peer.postMessage('first')
  await expect.poll(() => received).toEqual(['first'])
  stop()
  peer.postMessage('second')
  await new Promise((resolve) => setTimeout(resolve, 20))

  expect(received).toEqual(['first'])
})
