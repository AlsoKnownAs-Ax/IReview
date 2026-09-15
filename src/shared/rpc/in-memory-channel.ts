import type { Channel, RpcMessage, SendFailed } from './channel'
import type { Result } from './contract'

type Listener = (message: unknown) => void

/** Two connected channels for tests. Like a MessagePort, delivery is asynchronous and structured-cloned. */
export function createInMemoryChannelPair(): [Channel, Channel] {
  const channelEnd = (own: Set<Listener>, peer: Set<Listener>): Channel => ({
    send(message): Result<null, SendFailed> {
      const { data: copy, error } = cloneMessage(message)
      if (error) return { data: null, error }
      queueMicrotask(() => peer.forEach((listener) => listener(copy)))
      return { data: null, error: null }
    },
    onMessage(listener): () => void {
      own.add(listener)
      return () => own.delete(listener)
    },
  })
  const [a, b] = [new Set<Listener>(), new Set<Listener>()]
  return [channelEnd(a, b), channelEnd(b, a)]
}

function cloneMessage(message: RpcMessage): Result<RpcMessage, SendFailed> {
  try {
    return { data: structuredClone(message), error: null }
  } catch {
    return { data: null, error: { code: 'SEND_FAILED' } }
  }
}
