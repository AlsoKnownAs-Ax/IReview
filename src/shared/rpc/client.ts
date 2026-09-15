import { responseMessage, type Channel } from './channel'
import { RpcError, type Client, type Contract } from './contract'

/**
 * A typed caller for `contract` over `channel`. Calls the host fails reject with an `RpcError`. Request ids are only
 * unique per client, so each channel carries at most one client.
 */
export function createClient<C extends Contract>(contract: C, channel: Channel): Client<C> {
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: RpcError) => void }>()
  let nextId = 0

  channel.onMessage((raw) => {
    const response = responseMessage.safeParse(raw)
    if (!response.success) return
    const message = response.data
    const call = pending.get(message.id)
    pending.delete(message.id)
    if (message.kind === 'result') call?.resolve(message.value)
    else call?.reject(new RpcError(message.code, message.message))
  })

  const callerFor = (method: string) => (input: unknown) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve, reject })
      channel.send({ kind: 'request', id, method, input })
    })
  return Object.fromEntries(Object.keys(contract).map((method) => [method, callerFor(method)])) as Client<C>
}
