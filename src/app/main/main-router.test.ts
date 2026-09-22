import { describe, expect, test, vi } from 'vitest'
import type { ResolvedRepo } from '@/repo/contract'
import { createRepoRegistry } from '@/repo/main'
import type { mainContract, MainClient } from '@/shared/contract/main'
import { openChannel } from '@tests/fixtures/rpc-channel'
import { mainRouter, type MainRouterOptions } from './main-router'

const repo: ResolvedRepo = { identity: '/repo/.git', checkoutRoot: '/repo' }

function connectMain(options: Partial<MainRouterOptions> = {}) {
  const createWindow = vi.fn(() => ({ focus: (): void => {}, on: (): void => {} }))
  const registry = createRepoRegistry({ createWindow })
  const client: MainClient = openChannel<typeof mainContract>(
    mainRouter({ pickFolder: async (): Promise<null> => null, registry, ...options }),
  ).client
  return { client, createWindow }
}

describe('openRepo', () => {
  test('opens the Repo through the registry', async () => {
    const { client, createWindow } = connectMain()

    expect(await client.openRepo(repo)).toMatchObject({ data: undefined, error: null })
    expect(createWindow).toHaveBeenCalledWith(repo)
  })

  test.each([
    ['a missing checkoutRoot', { identity: '/repo/.git' }],
    ['a non-string identity', { identity: 1, checkoutRoot: '/repo' }],
    ['no object at all', 'C:\\repo'],
  ])('rejects %s without touching the registry', async (_case, input) => {
    const { client, createWindow } = connectMain()

    const { error } = await client.openRepo(input as never)

    expect(error).toMatchObject({ code: 'BAD_REQUEST' })
    expect(createWindow).not.toHaveBeenCalled()
  })
})

describe('windowRepo', () => {
  test('is null for the Welcome Window and the binding for a Repo Window', async () => {
    expect(await connectMain().client.windowRepo()).toMatchObject({ data: null, error: null })
    expect(await connectMain({ repo }).client.windowRepo()).toMatchObject({ data: repo, error: null })
  })
})

describe('pickFolder', () => {
  test('answers with the picked path', async () => {
    const { client } = connectMain({ pickFolder: async (): Promise<string> => 'C:\\picked' })

    expect(await client.pickFolder()).toMatchObject({ data: 'C:\\picked', error: null })
  })
})
