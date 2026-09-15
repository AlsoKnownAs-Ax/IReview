import { mkdir, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRepo, type TempRepo } from '../../../../tests/fixtures/repo-builder'
import { isWslPath, resolveRepo } from './resolve-repo'
import { runGit } from './run-git'

// The real runner, wrapped in a spy so a test can tell whether git ran at all.
vi.mock('./run-git', async (importOriginal) => {
  const { runGit } = await importOriginal<typeof import('./run-git')>()
  return { runGit: vi.fn(runGit) }
})

describe('isWslPath', () => {
  it.each([
    '\\\\wsl$\\Ubuntu\\home',
    '\\\\wsl.localhost\\Ubuntu\\home',
    '//WSL$/Ubuntu/home',
    '//Wsl.LocalHost/Ubuntu',
  ])('recognizes %j', (path) => {
    expect(isWslPath(path)).toBe(true)
  })

  it.each(['C:\\Users\\dev\\repo', '\\\\server\\share\\wsl$', '/home/dev/wsl.localhost', '\\\\wslhost\\share'])(
    'does not flag %j',
    (path) => {
      expect(isWslPath(path)).toBe(false)
    },
  )
})

describe('resolveRepo', () => {
  let repo: TempRepo

  beforeEach(async () => {
    repo = await buildRepo()
  })

  afterEach(async () => {
    await repo.cleanup()
  })

  it('resolves the Main checkout and a subfolder of it to the same real common dir', async () => {
    const subfolder = join(repo.main, 'src', 'nested')
    await mkdir(subfolder, { recursive: true })
    const commonDir = await realpath(join(repo.main, '.git'))

    expect(await resolveRepo({ path: repo.main })).toEqual({
      data: { identity: commonDir, checkoutRoot: await realpath(repo.main) },
      error: null,
    })
    expect((await resolveRepo({ path: subfolder })).data?.identity).toBe(commonDir)
  })

  it('resolves a linked Worktree to its Main checkout identity', async () => {
    const worktree = await repo.addWorktree('feature')

    expect(await resolveRepo({ path: worktree })).toEqual({
      data: { identity: await realpath(join(repo.main, '.git')), checkoutRoot: await realpath(worktree) },
      error: null,
    })
  })

  it('reports a plain folder as not a repo', async () => {
    const plain = join(repo.dir, 'plain')
    await mkdir(plain)

    expect(await resolveRepo({ path: plain })).toEqual({ data: null, error: { code: 'NOT_A_REPO', path: plain } })
  })

  it('reports a folder that does not exist as not found', async () => {
    const missing = join(repo.main, 'missing')

    expect(await resolveRepo({ path: missing })).toEqual({
      data: null,
      error: { code: 'PATH_NOT_FOUND', path: missing },
    })
  })

  it('refuses a WSL path without running git', async () => {
    vi.mocked(runGit).mockClear()
    const path = '\\\\wsl.localhost\\Ubuntu\\home\\dev\\repo'

    expect(await resolveRepo({ path })).toEqual({ data: null, error: { code: 'WSL_UNSUPPORTED', path } })
    expect(runGit).not.toHaveBeenCalled()
  })
})
