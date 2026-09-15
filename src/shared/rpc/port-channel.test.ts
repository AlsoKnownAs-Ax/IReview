import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import type { Channel } from './channel'
import { createClient } from './client'
import { rpc } from './contract'
import {
  createMessagePortChannel,
  createMessagePortMainChannel,
  type MainMessagePort,
  type WebMessagePort,
} from './port-channel'
import { serve } from './server'

type Listener = (event: { data: unknown }) => void
type FakeEnd = { listeners: Set<Listener>; queue: unknown[]; started: boolean }

const contract = { echo: rpc({ input: z.string(), result: z.string() }) }

/** Node's MessageChannel stands in for the DOM one. Its types give listeners a plain `Event`, not a `MessageEvent`. */
function domChannelPair(): [Channel, Channel] {
  const { port1, port2 } = new MessageChannel()
  const [a, b] = [port1, port2] as unknown as [WebMessagePort, WebMessagePort]
  return [createMessagePortChannel(a), createMessagePortChannel(b)]
}

/** A fake `MessageChannelMain`: cloned, asynchronous delivery, held until the receiving port is started. */
function mainChannelPair(): [Channel, Channel] {
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
  const fakeEnd = (): FakeEnd => ({ listeners: new Set(), queue: [], started: false })
  const [a, b] = [fakeEnd(), fakeEnd()]
  return [createMessagePortMainChannel(port(a, b)), createMessagePortMainChannel(port(b, a))]
}

describe.each([
  ['DOM MessagePort', domChannelPair],
  ['MessagePortMain', mainChannelPair],
])('over a %s', (_, channelPair) => {
  test('a call resolves with the handler result', async () => {
    const [clientEnd, hostEnd] = channelPair()
    serve(contract, { echo: (text) => ({ data: `echo: ${text}`, error: null }) }, hostEnd)

    await expect(createClient(contract, clientEnd).echo('hello')).resolves.toEqual({ data: 'echo: hello', error: null })
  })

  test('a removed listener receives nothing more', async () => {
    const [peer, channel] = channelPair()
    const received: unknown[] = []
    const stop = channel.onMessage((message) => received.push(message))

    peer.send({ kind: 'response', id: 1, data: 'first', error: null })
    await expect.poll(() => received).toHaveLength(1)
    stop()
    peer.send({ kind: 'response', id: 2, data: 'second', error: null })
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(received).toEqual([{ kind: 'response', id: 1, data: 'first', error: null }])
  })

  test('a message the port cannot clone is a SEND_FAILED value, not a throw', () => {
    const [channel] = channelPair()

    expect(channel.send({ kind: 'response', id: 1, data: () => 'uncloneable', error: null })).toEqual({
      data: null,
      error: { code: 'SEND_FAILED' },
    })
    expect(channel.send({ kind: 'response', id: 2, data: 'cloneable', error: null })).toEqual({
      data: null,
      error: null,
    })
  })
})
