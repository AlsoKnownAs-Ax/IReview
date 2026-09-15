import { useEffect, useState, type ReactElement } from 'react'
import type { WorkspaceClient } from '../../../shared/contract/workspace'
import type { CodedError } from '../../../shared/rpc/contract'

type HostConnection = { isConnected: boolean; error?: CodedError }

function hostStatusText({ isConnected, error }: HostConnection): string {
  if (error) return `Workspace host unavailable (${error.code})`
  if (isConnected) return 'Workspace host connected'
  return 'Connecting to workspace host…'
}

export function App({ workspaceHost }: { workspaceHost: Promise<WorkspaceClient> }): ReactElement {
  const [connection, setConnection] = useState<HostConnection>({ isConnected: false })

  useEffect((): (() => void) => {
    let isMounted = true
    void workspaceHost
      .then((host) => host.ping())
      .then(({ error }): void => {
        if (!isMounted) return
        if (error) return setConnection({ isConnected: false, error })
        setConnection({ isConnected: true })
      })
    return (): void => {
      isMounted = false
    }
  }, [workspaceHost])

  return (
    <>
      <h1>IReview</h1>
      <p data-testid="workspace-host-status">{hostStatusText(connection)}</p>
    </>
  )
}
