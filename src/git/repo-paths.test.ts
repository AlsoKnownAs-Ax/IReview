import { mkdir, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRepo, type TempRepo } from '@tests/fixtures/repo-builder'
import { readRepoPaths } from './repo-paths'

describe('readRepoPaths', () => {
  let repo: TempRepo

  beforeEach(async () => {
    repo = await buildRepo()
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await repo.cleanup()
  })

  it('reads the common dir and checkout root of a linked Worktree as absolute paths', async () => {
    const worktree = await repo.addWorktree('feature')

    const { data: paths, error } = await readRepoPaths({ cwd: worktree })

    expect(error).toBeNull()
    expect(await realpath(paths?.commonDir ?? '')).toBe(await realpath(join(repo.mainCheckout, '.git')))
    expect(await realpath(paths?.checkoutRoot ?? '')).toBe(await realpath(worktree))
  })

  it('reports a folder outside any repo as NOT_A_REPO', async () => {
    const plain = join(repo.dir, 'plain')
    await mkdir(plain)
    vi.stubEnv('GIT_CEILING_DIRECTORIES', repo.dir)

    expect(await readRepoPaths({ cwd: plain })).toEqual({ data: null, error: { code: 'NOT_A_REPO', path: plain } })
  })
})
