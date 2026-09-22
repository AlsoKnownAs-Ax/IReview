import { isDefinedError, toORPCError } from '@orpc/client'
import { useEffect, useState, type ReactElement } from 'react'
import type { ResolvedRepo } from '@/repo/contract'
import { openFolder } from '@/repo/renderer'
import { MINIMUM_GIT_VERSION, type GitVersion, type GitVersionError } from '@/shared/contract/git'
import type { MainClient } from '@/shared/contract/main'
import type { WorkspaceClient } from '@/shared/contract/workspace'
import { RepoWindow } from './RepoWindow'
import { WelcomeWindow } from './WelcomeWindow'

export type AppProps = { main: Promise<MainClient>; workspaceHost: Promise<WorkspaceClient> }

type HostConnection = { isConnected: boolean; errorCode?: string }

/** Which Window this is: unknown until main answers, then bound to `repo` or, without one, the Welcome Window. */
type WindowBinding = { isKnown: boolean; repo?: ResolvedRepo; errorCode?: string }

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
  if (errorCode) {
    return `Workspace host unavailable (${errorCode})`
  }

  if (isConnected) {
    return 'Workspace host connected'
  }

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
  if (errorCode) {
    return `Could not check git (${errorCode})`
  }

  if (error) {
    return gitErrorText(error)
  }

  if (version) {
    return `git ${formatGitVersion(version)}`
  }

  return 'Checking git…'
}

function windowFor(
  { isKnown, repo, errorCode }: WindowBinding,
  openFolderFromWelcome: () => ReturnType<typeof openFolder>,
): ReactElement | null {
  if (errorCode) {
    return <p role="alert">Could not tell which Repo this Window shows ({errorCode})</p>
  }

  if (!isKnown) {
    return null
  }

  if (repo) {
    return <RepoWindow repo={repo} />
  }

  return <WelcomeWindow openFolder={openFolderFromWelcome} />
}

export function App({ main, workspaceHost }: AppProps) {
  const [connection, setConnection] = useState<HostConnection>({ isConnected: false })
  const [git, setGit] = useState<GitCheck>({})
  const [binding, setBinding] = useState<WindowBinding>({ isKnown: false })

  useEffect(() => {
    let isMounted = true
    void main.then((client) => {
      void client.windowRepo().then(({ data: repo, error }) => {
        if (!isMounted) {
          return
        }

        if (error) {
          return setBinding({ isKnown: true, errorCode: toORPCError(error).code })
        }

        setBinding({ isKnown: true, repo: repo ?? undefined })
      })
    })
    return () => {
      isMounted = false
    }
  }, [main])

  useEffect(() => {
    let isMounted = true
    void workspaceHost.then((host) => {
      void host.ping().then(({ error }) => {
        if (!isMounted) {
          return
        }

        if (error) {
          return setConnection({ isConnected: false, errorCode: toORPCError(error).code })
        }

        setConnection({ isConnected: true })
      })
      void host.gitVersion().then(({ data: version, error }) => {
        if (!isMounted) {
          return
        }

        if (isDefinedError(error)) {
          return setGit({ error: error.data })
        }

        if (error) {
          return setGit({ errorCode: toORPCError(error).code })
        }

        setGit({ version })
      })
    })
    return () => {
      isMounted = false
    }
  }, [workspaceHost])

  async function openFolderFromWelcome(): ReturnType<typeof openFolder> {
    const [mainClient, hostClient] = await Promise.all([main, workspaceHost])
    return openFolder({ main: mainClient, workspaceHost: hostClient })
  }

  return (
    <main className="min-h-screen bg-canvas text-ink">
      {windowFor(binding, openFolderFromWelcome)}
      <p data-testid="workspace-host-status">{hostStatusText(connection)}</p>
      <p data-testid="git-version-status">{gitStatusText(git)}</p>
    </main>
  )
}
