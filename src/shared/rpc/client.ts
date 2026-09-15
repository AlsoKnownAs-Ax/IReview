import { hostMessage, type Channel, type ClientMessage, type HostMessage, type ResponseMessage } from './channel'
import type { Client, CodedError, Contract, Result, RpcResult, Unsubscribe } from './contract'

/** Receives the host's messages for one open call, stream or subscription. */
type Inbox = (message: HostMessage) => void
type Listener = (payload: unknown) => void
type Caller = (...args: never[]) => unknown

/**
 * A typed caller for `contract` over `channel`. Calls and subscriptions resolve to a `Result` and never reject;
 * streams yield `Result`s and never throw. Ids are only unique per client, so each channel carries at most one client.
 */
export function createClient<C extends Contract>(contract: C, channel: Channel): Client<C> {
  const inboxes = new Map<number, Inbox>()
  let nextId = 0

  channel.onMessage((raw): void => {
    const { success, data: message } = hostMessage.safeParse(raw)
    if (!success) return
    inboxes.get(message.id)?.(message)
  })

  /** Sends `message` with `inbox` receiving the replies to its id; a failed send removes the inbox and is returned. */
  function open(message: ClientMessage & { id: number }, inbox: Inbox): CodedError | null {
    inboxes.set(message.id, inbox)
    const { error } = channel.send(message)
    if (error) inboxes.delete(message.id)
    return error
  }

  function call(method: string, input: unknown): Promise<RpcResult> {
    return new Promise((resolve): void => {
      const id = nextId++
      const error = open({ kind: 'request', id, method, input }, (message): void => {
        if (message.kind !== 'response') return
        inboxes.delete(id)
        resolve(toResult(message))
      })
      if (error) resolve({ data: null, error })
    })
  }

  /** Resolves once the host accepts or rejects the subscription; `listener` gets every payload until unsubscribed. */
  function subscribe(event: string, listener: Listener): Promise<Result<Unsubscribe, CodedError>> {
    return new Promise((resolve): void => {
      const id = nextId++
      const unsubscribe = (): void => {
        if (inboxes.delete(id)) channel.send({ kind: 'cancel', id })
      }
      const settle = ({ error }: ResponseMessage): void => {
        if (!error) return resolve({ data: unsubscribe, error: null })
        inboxes.delete(id)
        resolve({ data: null, error })
      }
      const error = open({ kind: 'subscribe', id, event }, (message): void => {
        if (message.kind === 'event') return listener(message.payload)
        if (message.kind === 'response') settle(message)
      })
      if (error) resolve({ data: null, error })
    })
  }

  /** Aborting `signal`, or stopping iteration early, ends the iteration at once and cancels the stream on the host. */
  async function* openStream(method: string, input: unknown, signal?: AbortSignal): AsyncGenerator<RpcResult> {
    if (signal?.aborted) return
    const id = nextId++
    const received: HostMessage[] = []
    let wake = (): void => {}
    let settled = false
    /** Tells the host to stop, unless the stream already settled. */
    const cancel = (): void => {
      if (settled) return
      settled = true
      inboxes.delete(id)
      channel.send({ kind: 'cancel', id })
      wake()
    }
    signal?.addEventListener('abort', cancel)
    const error = open({ kind: 'stream', id, method, input }, (message): void => {
      received.push(message)
      wake()
    })
    if (error) received.push({ kind: 'response', id, data: null, error })

    try {
      for (;;) {
        if (signal?.aborted) return
        const message = received.shift()
        if (!message) {
          await new Promise<void>((resolve): void => {
            wake = resolve
          })
          continue
        }
        if (message.kind === 'item') {
          yield { data: message.data, error: null }
          continue
        }
        if (message.kind !== 'response') continue
        settled = true
        if (message.error) yield { data: null, error: message.error }
        return
      }
    } finally {
      signal?.removeEventListener('abort', cancel)
      inboxes.delete(id)
      // Covers a consumer that stopped before the stream settled, by `break`, `return` or a throw.
      cancel()
    }
  }

  const callers = {
    rpc: (name: string): Caller => call.bind(null, name),
    stream: (name: string): Caller => openStream.bind(null, name),
    event: (name: string): Caller => subscribe.bind(null, name),
  } satisfies Record<Contract[string]['kind'], (name: string) => Caller>

  const members = Object.entries(contract).map(([name, member]): [string, Caller] => [name, callers[member.kind](name)])
  return Object.fromEntries(members) as Client<C>
}

function toResult({ data, error }: ResponseMessage): RpcResult {
  if (error) return { data: null, error }
  return { data, error: null }
}
