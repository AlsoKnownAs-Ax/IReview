import type { Channel } from './channel'

type Listener = (event: { data: unknown }) => void

/** The part of a web-standard `MessagePort` the transport uses, so `src/shared` needs no DOM types. */
export type WebMessagePort = {
  postMessage(message: unknown): void
  addEventListener(type: 'message', listener: Listener): void
  removeEventListener(type: 'message', listener: Listener): void
  start(): void
}

/** The renderer-side transport over a DOM `MessagePort` (SPEC §5.2). */
export function createMessagePortChannel(port: WebMessagePort): Channel {
  port.start()
  return {
    send: (message) => port.postMessage(message),
    onMessage(listener) {
      const onEvent: Listener = (event) => listener(event.data)
      port.addEventListener('message', onEvent)
      return () => port.removeEventListener('message', onEvent)
    },
  }
}
