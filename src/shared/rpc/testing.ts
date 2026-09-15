import type { Channel, RpcMessage } from './channel'
import { createClient } from './client'
import type { Client, Contract, Handlers } from './contract'
import { createInMemoryChannelPair } from './in-memory-channel'
import { serve, type Server } from './server'

type Connection<C extends Contract> = { client: Client<C>; server: Server<C>; sent: RpcMessage[] }

/** Test helper: serves `handlers` over an in-memory channel and returns a client, plus every message the host sent. */
export function connect<C extends Contract>(contract: C, handlers: Handlers<C>): Connection<C> {
  const [clientEnd, serverEnd] = createInMemoryChannelPair()
  const sent: RpcMessage[] = []
  const recordingEnd: Channel = {
    onMessage: serverEnd.onMessage,
    send(message): ReturnType<Channel['send']> {
      sent.push(message)
      return serverEnd.send(message)
    },
  }
  const server = serve(contract, handlers, recordingEnd)
  return { client: createClient(contract, clientEnd), server, sent }
}
