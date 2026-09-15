import { useEffect, useState, type ReactElement } from 'react'
import type { WorkspaceClient } from '../../../shared/contract/workspace'

type HostStatus = 'connecting' | 'connected' | 'unavailable'

const HOST_STATUS_TEXT = {
  connecting: 'Connecting to workspace host…',
  connected: 'Workspace host connected',
  unavailable: 'Workspace host unavailable',
} satisfies Record<HostStatus, string>

export function App({ workspaceHost }: { workspaceHost: Promise<WorkspaceClient> }): ReactElement {
  const [status, setStatus] = useState<HostStatus>('connecting')

  useEffect(() => {
    let mounted = true
    const settle = (next: HostStatus) => (): void => {
      if (mounted) setStatus(next)
    }
    workspaceHost.then((host) => host.ping()).then(settle('connected'), settle('unavailable'))
    return () => {
      mounted = false
    }
  }, [workspaceHost])

  return (
    <>
      <h1>IReview</h1>
      <p data-testid="workspace-host-status">{HOST_STATUS_TEXT[status]}</p>
    </>
  )
}
