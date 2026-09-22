import type { mainContract, MainClient } from '@/shared/contract/main'
import { MAIN_PORT, WORKSPACE_HOST_PORT } from '@/shared/contract/ports'
import type { workspaceContract, WorkspaceClient } from '@/shared/contract/workspace'
import { connect, type Port } from '@/shared/rpc/rpc'

/**
 * Resolves with a client for this Window's workspace host once preload forwards its port (SPEC §5.2). Call it before
 * the page finishes loading, which is when main sends the port.
 */
export async function connectWorkspaceHost(): Promise<WorkspaceClient> {
  return connect<typeof workspaceContract>(await portNamed(WORKSPACE_HOST_PORT))
}

/** Resolves with a client for main, which serves each Window over a port of its own; same timing as the host's. */
export async function connectMain(): Promise<MainClient> {
  return connect<typeof mainContract>(await portNamed(MAIN_PORT))
}

/**
 * The first port posted into this page as `name` by its own window and origin, so no other frame or window can hand
 * the page a port.
 */
function portNamed(name: string): Promise<Port> {
  return new Promise((resolve) => {
    window.addEventListener('message', function onPort({ source, origin, data, ports: [port] }) {
      if (source !== window || origin !== location.origin || data !== name || !port) {
        return
      }

      window.removeEventListener('message', onPort)
      resolve(port)
    })
  })
}
