import { hostMessage, type Channel, type HostMessage, type ResponseMessage } from './channel'
import type { Client, CodedError, Contract, Result, RpcResult, Unsubscribe } from './contract'

type Inbox = (message: HostMessage) => void
type Listener = (payload: unknown) => void

/**
 * A typed caller for `contract` over `channel`. Calls and subscriptions resolve to a `Result` and never reject;
 * streams yield `Result`s and never throw. Ids are only unique per client, so each channel carries at most one client.
 */
export function createClient<C extends Contract>(contract: C, channel: Channel): Client<C> {
  /** Where the host's messages for each open call, stream or subscription go, by id. */
  const inboxes = new Map<number, Inbox>()
  let nextId = 0

  channel.onMessage((raw): void => {
    const { success, data: message } = hostMessage.safeParse(raw)
    if (!success) return
    inboxes.get(message.id)?.(message)
  })

  function call(method: string, input: unknown): Promise<RpcResult> {
    return new Promise((resolve) => {
      const id = nextId++
      inboxes.set(id, (message) => {
        if (message.kind !== 'response') return
        inboxes.delete(id)
        resolve(toResult(message))
      })
      const { error } = channel.send({ kind: 'request', id, method, input })
      if (!error) return
      inboxes.delete(id)
      resolve({ data: null, error })
    })
  }

  /** Resolves once the host accepts or rejects the subscription; `listener` gets every payload until unsubscribed. */
  function subscribe(event: string, listener: Listener): Promise<Result<Unsubscribe, CodedError>> {
    return new Promise((resolve) => {
      const id = nextId++
      const unsubscribe = (): void => {
        if (inboxes.delete(id)) channel.send({ kind: 'cancel', id })
      }
      inboxes.set(id, (message) => {
        if (message.kind === 'event') return listener(message.payload)
        if (message.kind !== 'response') return
        if (!message.error) return resolve({ data: unsubscribe, error: null })
        inboxes.delete(id)
        resolve({ data: null, error: message.error })
      })
      const { error } = channel.send({ kind: 'subscribe', id, event })
      if (!error) return
      inboxes.delete(id)
      resolve({ data: null, error })
    })
  }

  /** Aborting `signal`, or stopping iteration early, ends the iteration at once and cancels the stream on the host. */
  async function* openStream(method: string, input: unknown, signal?: AbortSignal): AsyncGenerator<RpcResult> {
    if (signal?.aborted) return
    const id = nextId++
    const received: HostMessage[] = []
    let wake = (): void => {}
    let ended = false
    /** Tells the host to stop, unless the stream already ended. */
    const cancel = (): void => {
      if (ended) return
      ended = true
      inboxes.delete(id)
      channel.send({ kind: 'cancel', id })
      wake()
    }
    inboxes.set(id, (message) => {
      received.push(message)
      wake()
    })
    signal?.addEventListener('abort', cancel)
    const { error } = channel.send({ kind: 'stream', id, method, input })
    if (error) received.push({ kind: 'end', id, error })

    try {
      for (;;) {
        if (signal?.aborted) return
        const message = received.shift()
        if (!message) {
          await new Promise<void>((resolve) => (wake = resolve))
          continue
        }
        if (message.kind === 'item') {
          yield { data: message.data, error: null }
          continue
        }
        if (message.kind !== 'end') continue
        ended = true
        if (message.error) yield { data: null, error: message.error }
        return
      }
    } finally {
      signal?.removeEventListener('abort', cancel)
      inboxes.delete(id)
      // Covers a consumer that stopped before the stream ended, by `break`, `return` or a throw.
      cancel()
    }
  }

  const callers = {
    rpc: (method: string) => (input: unknown) => call(method, input),
    stream: (method: string) => (input: unknown, signal?: AbortSignal) => openStream(method, input, signal),
    event: (event: string) => (listener: Listener) => subscribe(event, listener),
  } satisfies Record<Contract[string]['kind'], (method: string) => unknown>

  const members = Object.entries(contract).map(([name, member]) => [name, callers[member.kind](name)])
  return Object.fromEntries(members) as Client<C>
}

function toResult({ data, error }: ResponseMessage): RpcResult {
  if (error) return { data: null, error }
  return { data, error: null }
}
