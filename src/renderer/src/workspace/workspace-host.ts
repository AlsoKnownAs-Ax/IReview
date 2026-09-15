import { WORKSPACE_HOST_PORT } from '../../../shared/contract/ports'
import { workspaceContract, type WorkspaceClient } from '../../../shared/contract/workspace'
import { createClient } from '../../../shared/rpc/client'
import { createMessagePortChannel } from '../../../shared/rpc/port-channel'

/**
 * Resolves with a client for this Window's workspace host once preload forwards its port (SPEC §5.2). Call it before
 * the page finishes loading, which is when main sends the port. Only the first port posted by this page's own window
 * and origin is taken, so no other frame or window can hand the page a port.
 */
export function connectWorkspaceHost(): Promise<WorkspaceClient> {
  return new Promise((resolve) => {
    window.addEventListener('message', function onPort({ source, origin, data, ports: [port] }): void {
      if (source !== window || origin !== location.origin || data !== WORKSPACE_HOST_PORT || !port) return
      window.removeEventListener('message', onPort)
      resolve(createClient(workspaceContract, createMessagePortChannel(port)))
    })
  })
}
