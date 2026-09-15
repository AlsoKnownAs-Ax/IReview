import type { Channel } from './channel'

type Listener = (event: { data: unknown }) => void

/** The part of Electron's `MessagePortMain` the transport uses, typed structurally so `src/shared` imports no Electron. */
export type MainMessagePort = {
  postMessage(message: unknown): void
  on(event: 'message', listener: Listener): unknown
  off(event: 'message', listener: Listener): unknown
  start(): void
}

/** The host-side transport over the `MessagePortMain` a host receives on its `parentPort` (SPEC §5.2). */
export function createMessagePortMainChannel(port: MainMessagePort): Channel {
  // A `MessagePortMain` holds incoming messages until it is started.
  port.start()
  return {
    send: (message) => port.postMessage(message),
    onMessage(listener) {
      const onEvent: Listener = (event) => listener(event.data)
      port.on('message', onEvent)
      return () => port.off('message', onEvent)
    },
  }
}
