import { isDefinedError, toORPCError } from '@orpc/client'
import { useEffect, useState } from 'react'
import {
  MINIMUM_GIT_VERSION,
  type GitVersion,
  type GitVersionError,
  type WorkspaceClient,
} from '@shared/contract/workspace'
import { WelcomeWindow } from './WelcomeWindow'

type HostConnection = { isConnected: boolean; errorCode?: string }

/** `error` is a failure the git check declares; `errorCode` is any other failure of the call. */
type GitCheck = { version?: GitVersion; error?: GitVersionError; errorCode?: string }

type GitErrorByCode = { [E in GitVersionError as E['code']]: E }

type GitErrorCode = keyof GitErrorByCode

const GIT_ERROR_TEXT: { [C in GitErrorCode]: (error: GitErrorByCode[C]) => string } = {
  GIT_MISSING: () => needsGit('git was not found'),
  GIT_FAILED: ({ stderr }) => needsGit(`git could not report its version: ${stderr.trim()}`),
  GIT_VERSION_UNRECOGNIZED: () => needsGit('git reported a version IReview does not recognize'),
  GIT_TOO_OLD: ({ version }) => needsGit(`git ${formatGitVersion(version)} is too old`),
}

function hostStatusText({ isConnected, errorCode }: HostConnection) {
  if (errorCode) return `Workspace host unavailable (${errorCode})`
  if (isConnected) return 'Workspace host connected'

  return 'Connecting to workspace host…'
}

function formatGitVersion({ major, minor, patch }: GitVersion): string {
  return `${major}.${minor}.${patch}`
}

function needsGit(problem: string): string {
  return `${problem}. IReview needs git ${MINIMUM_GIT_VERSION.major}.${MINIMUM_GIT_VERSION.minor} or newer.`
}

function gitErrorText<C extends GitErrorCode>(error: GitErrorByCode[C] & { code: C }): string {
  const toText: (error: GitErrorByCode[C]) => string = GIT_ERROR_TEXT[error.code]
  return toText(error)
}

function gitStatusText({ version, error, errorCode }: GitCheck): string {
  if (errorCode) return `Could not check git (${errorCode})`
  if (error) return gitErrorText(error)
  if (version) return `git ${formatGitVersion(version)}`
  return 'Checking git…'
}

export function App({ workspaceHost }: { workspaceHost: Promise<WorkspaceClient> }) {
  const [connection, setConnection] = useState<HostConnection>({ isConnected: false })
  const [git, setGit] = useState<GitCheck>({})

  useEffect(() => {
    let isMounted = true
    void workspaceHost.then((host) => {
      void host.ping().then(({ error }) => {
        if (!isMounted) return
        if (error) return setConnection({ isConnected: false, errorCode: toORPCError(error).code })

        setConnection({ isConnected: true })
      })
      void host.gitVersion().then(({ data: version, error }) => {
        if (!isMounted) return
        if (isDefinedError(error)) return setGit({ error: error.data })
        if (error) return setGit({ errorCode: toORPCError(error).code })
        setGit({ version })
      })
    })
    return () => {
      isMounted = false
    }
  }, [workspaceHost])

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <WelcomeWindow />
      <p data-testid="workspace-host-status">{hostStatusText(connection)}</p>
      <p data-testid="git-version-status">{gitStatusText(git)}</p>
    </main>
  )
}
