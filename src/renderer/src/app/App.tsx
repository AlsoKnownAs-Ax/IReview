import { useEffect, useState, type ReactElement } from 'react'
import type { WorkspaceClient } from '../../../shared/contract/workspace'

function hostStatusText(isConnected: boolean): string {
  if (isConnected) return 'Workspace host connected'
  return 'Connecting to workspace host…'
}

export function App({ workspaceHost }: { workspaceHost: Promise<WorkspaceClient> }): ReactElement {
  const [isConnected, setConnected] = useState(false)

  useEffect(() => {
    let isMounted = true
    void workspaceHost
      .then((host) => host.ping())
      .then((): void => {
        if (isMounted) setConnected(true)
      })
    return (): void => {
      isMounted = false
    }
  }, [workspaceHost])

  return (
    <>
      <h1>IReview</h1>
      <p data-testid="workspace-host-status">{hostStatusText(isConnected)}</p>
    </>
  )
}
