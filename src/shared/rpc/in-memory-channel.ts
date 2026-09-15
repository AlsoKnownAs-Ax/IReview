import type { Channel } from './channel'

type Listener = (message: unknown) => void

/** Two connected channels for tests. Like a MessagePort, delivery is asynchronous and structured-cloned. */
export function createInMemoryChannelPair(): [Channel, Channel] {
  const channelEnd = (own: Set<Listener>, peer: Set<Listener>): Channel => ({
    send(message) {
      const copy = structuredClone(message)
      queueMicrotask(() => peer.forEach((listener) => listener(copy)))
    },
    onMessage(listener) {
      own.add(listener)
      return () => own.delete(listener)
    },
  })
  const [a, b] = [new Set<Listener>(), new Set<Listener>()]
  return [channelEnd(a, b), channelEnd(b, a)]
}
