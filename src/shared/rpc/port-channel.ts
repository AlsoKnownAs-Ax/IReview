import type { Channel, RpcMessage, SendFailed } from './channel'
import type { Result } from './contract'

export type PortListener = (event: { data: unknown }) => void

type MessagePortBase = {
  postMessage(message: unknown): void
  start(): void
}

/** The part of a web-standard (DOM) `MessagePort` the renderer transport uses. */
export type WebMessagePort = MessagePortBase & {
  addEventListener(type: 'message', listener: PortListener): void
  removeEventListener(type: 'message', listener: PortListener): void
}

/** The part of Electron's `MessagePortMain` the host transport uses, typed structurally so `src/shared` imports no Electron. */
export type MainMessagePort = MessagePortBase & {
  on(event: 'message', listener: PortListener): unknown
  off(event: 'message', listener: PortListener): unknown
}

/** The renderer-side transport over a DOM `MessagePort` (SPEC §5.2). */
export function createMessagePortChannel(port: WebMessagePort): Channel {
  return portChannel(port, (listener): (() => void) => {
    port.addEventListener('message', listener)
    return (): void => port.removeEventListener('message', listener)
  })
}

/** The host-side transport over the `MessagePortMain` a host receives on its `parentPort` (SPEC §5.2). */
export function createMessagePortMainChannel(port: MainMessagePort): Channel {
  return portChannel(port, (listener): (() => void) => {
    port.on('message', listener)
    return (): void => void port.off('message', listener)
  })
}

function portChannel(port: MessagePortBase, listen: (listener: PortListener) => () => void): Channel {
  // Both kinds of port hold incoming messages until they are started.
  port.start()
  return {
    send: (message): Result<null, SendFailed> => postSafely(port, message),
    onMessage: (listener): (() => void) => listen((event): void => listener(event.data)),
  }
}

/** `postMessage` throws for a message it cannot structured-clone; that becomes a `SEND_FAILED` value. */
function postSafely(port: MessagePortBase, message: RpcMessage): Result<null, SendFailed> {
  try {
    port.postMessage(message)
    return { data: null, error: null }
  } catch {
    return { data: null, error: { code: 'SEND_FAILED' } }
  }
}
