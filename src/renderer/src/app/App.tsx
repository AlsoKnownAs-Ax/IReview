import { toORPCError } from '@orpc/client'
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import type { WorkspaceClient } from '@shared/contract/workspace'

type HostConnection = { isConnected: boolean; errorCode?: string }

function hostStatusText({ isConnected, errorCode }: HostConnection) {
  if (errorCode) return `Workspace host unavailable (${errorCode})`
  if (isConnected) return 'Workspace host connected'

  return 'Connecting to workspace host…'
}

export function App({ workspaceHost }: { workspaceHost: Promise<WorkspaceClient> }): ReactElement {
  const [connection, setConnection] = useState<HostConnection>({ isConnected: false })

  useEffect(() => {
    let isMounted = true
    void workspaceHost
      .then((host) => host.ping())
      .then(({ error }) => {
        if (!isMounted) return
        if (error) return setConnection({ isConnected: false, errorCode: toORPCError(error).code })

        setConnection({ isConnected: true })
      })
    return () => {
      isMounted = false
    }
  }, [workspaceHost])

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <h1>IReview</h1>
      <p data-testid="workspace-host-status">{hostStatusText(connection)}</p>
    </main>
  )
}
