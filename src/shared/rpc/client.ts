import { responseMessage, trySend, type Channel, type ResponseMessage } from './channel'
import type { Client, CodedError, Contract, Result } from './contract'

type Response = Result<unknown, CodedError>

/**
 * A typed caller for `contract` over `channel`. Calls resolve to a `Result` and never reject. Request ids are only
 * unique per client, so each channel carries at most one client.
 */
export function createClient<C extends Contract>(contract: C, channel: Channel): Client<C> {
  const pending = new Map<number, (response: Response) => void>()
  let nextId = 0

  channel.onMessage((message) => {
    const { success, data: response } = responseMessage.safeParse(message)
    if (!success) return
    pending.get(response.id)?.(toResult(response))
    pending.delete(response.id)
  })

  const callerFor =
    (method: string) =>
    (input: unknown): Promise<Response> =>
      new Promise((resolve) => {
        const id = nextId++
        pending.set(id, resolve)
        const { error } = trySend(channel, { kind: 'request', id, method, input })
        if (!error) return
        pending.delete(id)
        resolve({ data: null, error })
      })

  return Object.fromEntries(Object.keys(contract).map((method) => [method, callerFor(method)])) as Client<C>
}

function toResult({ data, error }: ResponseMessage): Response {
  if (error) return { data: null, error }
  return { data, error: null }
}
