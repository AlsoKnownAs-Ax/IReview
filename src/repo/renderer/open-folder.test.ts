import { createSafeClient, ORPCError } from '@orpc/client'
import type { ContractRouterClient } from '@orpc/contract'
import { describe, expect, test, vi } from 'vitest'
import type { ResolvedRepo } from '@/repo/contract'
import type { mainContract } from '@/shared/contract/main'
import type { workspaceContract } from '@/shared/contract/workspace'
import { openFolder, type OpenFolderClients } from './open-folder'

const repo: ResolvedRepo = { identity: '/repo/.git', checkoutRoot: '/repo' }

type MainProcedures = ContractRouterClient<typeof mainContract>
type WorkspaceProcedures = ContractRouterClient<typeof workspaceContract>

type FakeClients = OpenFolderClients & {
  openRepo: MainProcedures['openRepo']
  resolveRepo: WorkspaceProcedures['resolveRepo']
}

function fakeClients(
  main: Partial<MainProcedures> = {},
  workspaceHost: Partial<WorkspaceProcedures> = {},
): FakeClients {
  const openRepo = vi.fn<MainProcedures['openRepo']>(async () => {})
  const resolveRepo = vi.fn<WorkspaceProcedures['resolveRepo']>(async () => repo)
  return {
    main: createSafeClient<MainProcedures>({
      pickFolder: async () => '/repo',
      openRepo,
      windowRepo: async () => null,
      ...main,
    }),
    workspaceHost: createSafeClient<WorkspaceProcedures>({
      ping: async () => 'pong',
      gitVersion: async () => ({ major: 2, minor: 50, patch: 0 }),
      resolveRepo,
      ...workspaceHost,
    }),
    openRepo,
    resolveRepo,
  }
}

describe('openFolder', () => {
  test('opens the Repo the host resolves for the picked folder', async () => {
    const clients = fakeClients()

    expect(await openFolder(clients)).toEqual({ data: 'opened', error: null })
    expect(clients.resolveRepo).toHaveBeenCalledWith({ path: '/repo' })
    expect(clients.openRepo).toHaveBeenCalledWith(repo)
  })

  test('does nothing when the picker is cancelled', async () => {
    const clients = fakeClients({ pickFolder: async () => null })

    expect(await openFolder(clients)).toEqual({ data: 'cancelled', error: null })
    expect(clients.resolveRepo).not.toHaveBeenCalled()
  })

  test('passes a failure the host declares through and opens nothing', async () => {
    const declared = { code: 'NOT_A_REPO', path: '/repo' } as const
    const clients = fakeClients(
      {},
      {
        resolveRepo: async () => {
          throw new ORPCError('NOT_A_REPO', { data: declared, defined: true })
        },
      },
    )

    expect(await openFolder(clients)).toEqual({ data: null, error: declared })
    expect(clients.openRepo).not.toHaveBeenCalled()
  })

  test('reports which call failed when one fails outright', async () => {
    const clients = fakeClients({
      openRepo: async () => {
        throw new ORPCError('SERVICE_UNAVAILABLE')
      },
    })

    expect(await openFolder(clients)).toEqual({
      data: null,
      error: { code: 'CALL_FAILED', call: 'openRepo', errorCode: 'SERVICE_UNAVAILABLE' },
    })
  })
})
