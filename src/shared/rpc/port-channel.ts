import type { Channel, RpcMessage, SendFailed } from './channel'
import type { Result } from './contract'

type PortListener = (event: { data: unknown }) => void
type Unsubscribe = () => void

/** The part of a web-standard (DOM) `MessagePort` the renderer transport uses. */
export type WebMessagePort = {
  postMessage(message: unknown): void
  addEventListener(type: 'message', listener: PortListener): void
  removeEventListener(type: 'message', listener: PortListener): void
  start(): void
}

/** The part of Electron's `MessagePortMain` the host transport uses, typed structurally so `src/shared` imports no Electron. */
export type MainMessagePort = {
  postMessage(message: unknown): void
  on(event: 'message', listener: PortListener): unknown
  off(event: 'message', listener: PortListener): unknown
  start(): void
}

/** The renderer-side transport over a DOM `MessagePort` (SPEC §5.2). */
export function createMessagePortChannel(port: WebMessagePort): Channel {
  return portChannel(port, (listener): Unsubscribe => {
    port.addEventListener('message', listener)
    return () => port.removeEventListener('message', listener)
  })
}

/** The host-side transport over the `MessagePortMain` a host receives on its `parentPort` (SPEC §5.2). */
export function createMessagePortMainChannel(port: MainMessagePort): Channel {
  return portChannel(port, (listener): Unsubscribe => {
    port.on('message', listener)
    return () => port.off('message', listener)
  })
}

function portChannel(port: WebMessagePort | MainMessagePort, listen: (listener: PortListener) => Unsubscribe): Channel {
  // Both kinds of port hold incoming messages until they are started.
  port.start()
  return {
    send: (message): Result<null, SendFailed> => postSafely(port, message),
    onMessage: (listener): Unsubscribe => listen((event) => listener(event.data)),
  }
}

/** `postMessage` throws for a message it cannot structured-clone; that becomes a `SEND_FAILED` value. */
function postSafely(port: WebMessagePort | MainMessagePort, message: RpcMessage): Result<null, SendFailed> {
  try {
    port.postMessage(message)
    return { data: null, error: null }
  } catch {
    return { data: null, error: { code: 'SEND_FAILED' } }
  }
}
