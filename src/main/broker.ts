import { join } from 'node:path'
import { MessageChannelMain, utilityProcess, type BrowserWindow } from 'electron'
import { WORKSPACE_HOST_PORT } from '@shared/contract/ports'

/**
 * Starts `window`'s workspace host and, on every page load, hands the host and the renderer the two ends of a fresh
 * channel. Main only brokers the ports and never relays a message (SPEC §5.1–5.2, ADR-0006). The host dies with the
 * Window.
 */
export function startWorkspaceHost(window: BrowserWindow) {
  //TODO: make a constants / config file for e.g app name
  const host = utilityProcess.fork(join(__dirname, 'workspace-host.js'), [], { serviceName: 'IReview Workspace Host' })
  const contents = window.webContents

  contents.on('did-finish-load', () => {
    const { port1, port2 } = new MessageChannelMain()
    host.postMessage(null, [port1])
    contents.postMessage(WORKSPACE_HOST_PORT, null, [port2])
  })
  window.on('closed', () => host.kill())
}
