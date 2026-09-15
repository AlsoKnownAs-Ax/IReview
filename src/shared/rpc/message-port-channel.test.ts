import { afterEach, expect, test } from 'vitest'
import { z } from 'zod'
import { createClient } from './client'
import { rpc } from './contract'
import { createMessagePortChannel, type WebMessagePort } from './message-port-channel'
import { serve } from './server'

const contract = { echo: rpc({ input: z.string(), result: z.string() }) }
const opened: { close(): void }[] = []

/** Node's MessageChannel. Its types give listeners a plain `Event`, but at runtime they get a `MessageEvent`. */
function messageChannel(): [WebMessagePort, WebMessagePort] {
  const { port1, port2 } = new MessageChannel()
  opened.push(port1, port2)
  return [port1, port2] as unknown as [WebMessagePort, WebMessagePort]
}

afterEach(() => opened.splice(0).forEach((port) => port.close()))

test('a call and its response cross a MessageChannel', async () => {
  const [clientPort, hostPort] = messageChannel()
  serve(contract, { echo: (text) => `echo: ${text}` }, createMessagePortChannel(hostPort))
  const client = createClient(contract, createMessagePortChannel(clientPort))

  await expect(client.echo('hello')).resolves.toBe('echo: hello')
})

test('a removed listener receives nothing more', async () => {
  const [peer, port] = messageChannel()
  const received: unknown[] = []
  const stop = createMessagePortChannel(port).onMessage((message) => received.push(message))

  peer.postMessage('first')
  await expect.poll(() => received).toEqual(['first'])
  stop()
  peer.postMessage('second')
  await new Promise((resolve) => setTimeout(resolve, 20))

  expect(received).toEqual(['first'])
})
