import { join } from 'node:path'
import { MessageChannelMain, utilityProcess, type BrowserWindow, type MessagePortMain } from 'electron'
import type { mainContract } from '@/shared/contract/main'
import { MAIN_PORT, WORKSPACE_HOST_PORT } from '@/shared/contract/ports'
import { serve } from '@/shared/rpc/rpc'
import type { MainRouter } from './main-router'

/**
 * Starts `window`'s workspace host and, on every page load, hands the host and the renderer the two ends of a fresh
 * channel. Main only brokers the ports and never relays a message (SPEC §5.1–5.2, ADR-0006). The host dies with the
 * Window.
 */
export function startWorkspaceHost(window: BrowserWindow) {
  //TODO: make a constants / config file for e.g app name
  const host = utilityProcess.fork(join(__dirname, 'workspace-host.js'), [], { serviceName: 'IReview Workspace Host' })

  brokerOnEachLoad(window, WORKSPACE_HOST_PORT, (port) => host.postMessage(null, [port]))
  window.on('closed', () => host.kill())
}

/** Serves main's own contract to `window` over a fresh channel on every page load, brokered like the host's. */
export function serveMain(window: BrowserWindow, router: MainRouter): void {
  brokerOnEachLoad(window, MAIN_PORT, (port) => serve<typeof mainContract>(router, port))
}

/** On every page load, posts one end of a fresh channel into the page as `name` and hands the other to `serveOn`. */
function brokerOnEachLoad(window: BrowserWindow, name: string, serveOn: (port: MessagePortMain) => void): void {
  const contents = window.webContents

  contents.on('did-finish-load', () => {
    const { port1, port2 } = new MessageChannelMain()
    serveOn(port1)
    contents.postMessage(name, null, [port2])
  })
}
