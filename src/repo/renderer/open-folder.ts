import { isDefinedError, toORPCError } from '@orpc/client'
import type { ResolveRepoError } from '@/repo/contract'
import type { MainClient } from '@/shared/contract/main'
import type { WorkspaceClient } from '@/shared/contract/workspace'
import type { Result } from '@/shared/result'

export type OpenFolderClients = { main: MainClient; workspaceHost: WorkspaceClient }

export type OpenFolderOutcome = 'opened' | 'cancelled'

type OpenFolderCall = 'pickFolder' | 'resolveRepo' | 'openRepo'

/** What resolving the folder declares, or a call to main or the host failing outright, such as on a closed port. */
export type OpenFolderError = ResolveRepoError | { code: 'CALL_FAILED'; call: OpenFolderCall; errorCode: string }

/**
 * Open Folder (SPEC §3.1): main shows the picker, this Window's host resolves the folder's Repo, and main opens its
 * Window or focuses the one already open. Nothing opens on an error, so the Welcome Window can explain it.
 */
export async function openFolder({
  main,
  workspaceHost,
}: OpenFolderClients): Promise<Result<OpenFolderOutcome, OpenFolderError>> {
  const { data: path, error: pickError } = await main.pickFolder()

  if (pickError) {
    return callFailed('pickFolder', pickError)
  }

  if (path === null) {
    return { data: 'cancelled', error: null }
  }

  const { data: repo, error: resolveError } = await workspaceHost.resolveRepo({ path })

  if (isDefinedError(resolveError)) {
    return { data: null, error: resolveError.data }
  }

  if (resolveError) {
    return callFailed('resolveRepo', resolveError)
  }

  const { error: openError } = await main.openRepo(repo)

  if (openError) {
    return callFailed('openRepo', openError)
  }

  return { data: 'opened', error: null }
}

function callFailed(call: OpenFolderCall, error: unknown): Result<never, OpenFolderError> {
  return { data: null, error: { code: 'CALL_FAILED', call, errorCode: toORPCError(error).code } }
}
