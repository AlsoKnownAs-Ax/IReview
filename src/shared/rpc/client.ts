import { responseMessage, type Channel, type ResponseMessage } from './channel'
import type { Client, Contract, RpcResult } from './contract'

/**
 * A typed caller for `contract` over `channel`. Calls resolve to a `Result` and never reject. Request ids are only
 * unique per client, so each channel carries at most one client.
 */
export function createClient<C extends Contract>(contract: C, channel: Channel): Client<C> {
  const pending = new Map<number, (result: RpcResult) => void>()
  let nextId = 0

  channel.onMessage((message): void => {
    const { success, data: response } = responseMessage.safeParse(message)
    if (!success) return
    pending.get(response.id)?.(toResult(response))
    pending.delete(response.id)
  })

  function call(method: string, input: unknown): Promise<RpcResult> {
    return new Promise((resolve) => {
      const id = nextId++
      pending.set(id, resolve)
      const { error } = channel.send({ kind: 'request', id, method, input })
      if (!error) return
      pending.delete(id)
      resolve({ data: null, error })
    })
  }

  const methods = Object.keys(contract).map((method) => [
    method,
    (input: unknown): Promise<RpcResult> => call(method, input),
  ])
  return Object.fromEntries(methods) as Client<C>
}

function toResult({ data, error }: ResponseMessage): RpcResult {
  if (error) return { data: null, error }
  return { data, error: null }
}
