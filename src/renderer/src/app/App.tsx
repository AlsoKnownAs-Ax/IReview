import { useEffect, useState, type ReactElement } from 'react'
import type { GitVersion, GitVersionError, WorkspaceClient } from '../../../shared/contract/workspace'
import type { CodedError } from '../../../shared/rpc/contract'

type HostConnection = { isConnected: boolean; error?: CodedError }

type GitCheck = { version?: GitVersion; error?: CodedError }

const GIT_PROBLEM = {
  GIT_MISSING: 'git was not found',
  GIT_FAILED: 'git could not report its version',
  GIT_VERSION_UNRECOGNIZED: 'git reported a version IReview does not recognize',
} satisfies Record<Exclude<GitVersionError['code'], 'GIT_TOO_OLD'>, string>

const GIT_PROBLEMS = new Map<string, string>(Object.entries(GIT_PROBLEM))

function hostStatusText({ isConnected, error }: HostConnection): string {
  if (error) return `Workspace host unavailable (${error.code})`
  if (isConnected) return 'Workspace host connected'
  return 'Connecting to workspace host…'
}

function formatGitVersion({ major, minor, patch }: GitVersion): string {
  return `${major}.${minor}.${patch}`
}

function gitStatusText({ version, error }: GitCheck): string {
  if (error) return `${gitProblemText(error)}. IReview needs git 2.40 or newer.`
  if (version) return `git ${formatGitVersion(version)}`
  return 'Checking git…'
}

function gitProblemText(error: CodedError): string {
  if (isTooOld(error)) return `git ${formatGitVersion(error.version)} is too old`
  return GIT_PROBLEMS.get(error.code) ?? `git could not be checked (${error.code})`
}

function isTooOld(error: CodedError): error is Extract<GitVersionError, { code: 'GIT_TOO_OLD' }> {
  return error.code === 'GIT_TOO_OLD'
}

export function App({ workspaceHost }: { workspaceHost: Promise<WorkspaceClient> }): ReactElement {
  const [connection, setConnection] = useState<HostConnection>({ isConnected: false })
  const [git, setGit] = useState<GitCheck>({})

  useEffect((): (() => void) => {
    let isMounted = true
    void workspaceHost.then((host): void => {
      void host.ping().then(({ error }): void => {
        if (!isMounted) return
        if (error) return setConnection({ isConnected: false, error })
        setConnection({ isConnected: true })
      })
      void host.gitVersion().then(({ data: version, error }): void => {
        if (!isMounted) return
        if (error) return setGit({ error })
        setGit({ version })
      })
    })
    return (): void => {
      isMounted = false
    }
  }, [workspaceHost])

  return (
    <>
      <h1>IReview</h1>
      <p data-testid="workspace-host-status">{hostStatusText(connection)}</p>
      <p data-testid="git-version-status">{gitStatusText(git)}</p>
    </>
  )
}
