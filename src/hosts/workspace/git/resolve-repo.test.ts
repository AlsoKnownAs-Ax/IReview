import { mkdir, realpath, symlink } from 'node:fs/promises'
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
  it.each(['\\\\wsl$\\Ubuntu\\home', '//Wsl.LocalHost/Ubuntu', '\\\\?\\UNC\\wsl.localhost\\Ubuntu'])(
    'recognizes %j',
    (path) => {
      expect(isWslPath(path)).toBe(true)
    },
  )

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
    vi.unstubAllEnvs()
    await repo.cleanup()
  })

  it('resolves the Main checkout, a subfolder and a link to it to the same real paths', async () => {
    const subfolder = join(repo.mainCheckout, 'src')
    await mkdir(subfolder)
    const link = join(repo.dir, 'link')
    await symlink(repo.mainCheckout, link, 'junction')
    const commonDir = await realpath(join(repo.mainCheckout, '.git'))
    const mainCheckout = await realpath(repo.mainCheckout)

    for (const path of [repo.mainCheckout, subfolder, link]) {
      expect(await resolveRepo({ path })).toEqual({
        data: { identity: commonDir, checkoutRoot: mainCheckout },
        error: null,
      })
    }
  })

  it('resolves a linked Worktree to its Main checkout identity', async () => {
    const worktree = await repo.addWorktree('feature')

    expect(await resolveRepo({ path: worktree })).toEqual({
      data: { identity: await realpath(join(repo.mainCheckout, '.git')), checkoutRoot: await realpath(worktree) },
      error: null,
    })
  })

  it('reports a plain folder as not a repo', async () => {
    const plain = join(repo.dir, 'plain')
    await mkdir(plain)
    // Keeps git from finding a repo above the temp dir, such as a dotfiles repo in the home folder.
    vi.stubEnv('GIT_CEILING_DIRECTORIES', repo.dir)

    expect(await resolveRepo({ path: plain })).toEqual({ data: null, error: { code: 'NOT_A_REPO', path: plain } })
  })

  it('reports a folder that does not exist as not found', async () => {
    const missing = join(repo.mainCheckout, 'missing')

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
