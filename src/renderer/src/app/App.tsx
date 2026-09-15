import { useEffect, useState, type ReactElement } from 'react'
import {
  MINIMUM_GIT_VERSION,
  type GitVersion,
  type GitVersionError,
  type WorkspaceClient,
} from '../../../shared/contract/workspace'
import type { CodedError, RpcFailure } from '../../../shared/rpc/contract'

type HostConnection = { isConnected: boolean; error?: CodedError }

type GitCheckError = GitVersionError | RpcFailure

type GitCheck = { version?: GitVersion; error?: GitCheckError }

type GitErrorByCode = { [E in GitCheckError as E['code']]: E }

type GitErrorCode = keyof GitErrorByCode

const GIT_ERROR_TEXT: { [C in GitErrorCode]: (error: GitErrorByCode[C]) => string } = {
  GIT_MISSING: () => needsGit('git was not found'),
  GIT_FAILED: ({ stderr }) => needsGit(`git could not report its version: ${stderr.trim()}`),
  GIT_VERSION_UNRECOGNIZED: () => needsGit('git reported a version IReview does not recognize'),
  GIT_TOO_OLD: ({ version }) => needsGit(`git ${formatGitVersion(version)} is too old`),
  INVALID_INPUT: gitUncheckedText,
  UNKNOWN_METHOD: gitUncheckedText,
  SEND_FAILED: gitUncheckedText,
  INTERNAL: gitUncheckedText,
}

function hostStatusText({ isConnected, error }: HostConnection): string {
  if (error) return `Workspace host unavailable (${error.code})`
  if (isConnected) return 'Workspace host connected'
  return 'Connecting to workspace host…'
}

function formatGitVersion({ major, minor, patch }: GitVersion): string {
  return `${major}.${minor}.${patch}`
}

function needsGit(problem: string): string {
  return `${problem}. IReview needs git ${MINIMUM_GIT_VERSION.major}.${MINIMUM_GIT_VERSION.minor} or newer.`
}

function gitUncheckedText({ code }: RpcFailure): string {
  return `Could not check git (${code})`
}

function gitErrorText<C extends GitErrorCode>(error: GitErrorByCode[C] & { code: C }): string {
  const toText: (error: GitErrorByCode[C]) => string = GIT_ERROR_TEXT[error.code]
  return toText(error)
}

function gitStatusText({ version, error }: GitCheck): string {
  if (error) return gitErrorText(error)
  if (version) return `git ${formatGitVersion(version)}`
  return 'Checking git…'
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
