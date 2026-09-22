import { execFileSync } from 'node:child_process'
import { chmod, mkdir, realpath, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isDefinedError } from '@orpc/client'
import { afterEach, assert, beforeEach, describe, expect, test, vi } from 'vitest'
import type { WorkspaceClient, workspaceContract } from '@/shared/contract/workspace'
import { openChannel } from '@tests/fixtures/rpc-channel'
import { buildRepo, type TempRepo } from '@tests/fixtures/repo-builder'
import { workspaceRouter, type WorkspaceRouterOptions } from './workspace-router'

let repo: TempRepo

beforeEach(async () => {
  repo = await buildRepo()
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await repo.cleanup()
})

function connectWorkspace(options?: WorkspaceRouterOptions): WorkspaceClient {
  return openChannel<typeof workspaceContract>(workspaceRouter(options)).client
}

/** A POSIX script answering `--version` with `output`. Windows starts only real executables without a shell. */
async function fakeGit(output: string): Promise<string> {
  const path = join(repo.dir, 'fake-git')
  await writeFile(path, `#!/bin/sh\necho '${output}'\n`)
  await chmod(path, 0o755)
  return path
}

describe('gitVersion', () => {
  test('returns the version of the system git', async () => {
    const { data: version, error } = await connectWorkspace().gitVersion()

    assert(version, `gitVersion failed with ${JSON.stringify(error)}`)
    const { major, minor, patch } = version
    expect(execFileSync('git', ['--version'], { encoding: 'utf8' })).toContain(`git version ${major}.${minor}.${patch}`)
  })

  test('reports a git that cannot be started as GIT_MISSING', async () => {
    const { error } = await connectWorkspace({ gitExecutable: join(repo.dir, 'no-such-git') }).gitVersion()

    assert(isDefinedError(error))
    expect([error.code, error.data]).toEqual(['GIT_MISSING', { code: 'GIT_MISSING' }])
  })

  test('reports output that is not a git version as GIT_VERSION_UNRECOGNIZED, carrying the output', async () => {
    // Node answers `--version` with `v24.…`, which no git prints.
    const { error } = await connectWorkspace({ gitExecutable: process.execPath }).gitVersion()

    assert(isDefinedError(error))
    const output = execFileSync(process.execPath, ['--version'], { encoding: 'utf8' })
    expect([error.code, error.data]).toEqual(['GIT_VERSION_UNRECOGNIZED', { code: 'GIT_VERSION_UNRECOGNIZED', output }])
  })

  test.skipIf(process.platform === 'win32')('reports a git below the minimum as GIT_TOO_OLD', async () => {
    const { error } = await connectWorkspace({ gitExecutable: await fakeGit('git version 2.39.0') }).gitVersion()

    assert(isDefinedError(error))
    const version = { major: 2, minor: 39, patch: 0 }
    expect([error.code, error.data]).toEqual(['GIT_TOO_OLD', { code: 'GIT_TOO_OLD', version }])
  })
})

describe('resolveRepo', () => {
  test('returns the identity and checkout root of a Main checkout and of its linked Worktree', async () => {
    const worktree = await repo.addWorktree('feature')
    const identity = await realpath(join(repo.mainCheckout, '.git'))
    const client = connectWorkspace()

    expect(await client.resolveRepo({ path: repo.mainCheckout })).toMatchObject({
      data: { identity, checkoutRoot: await realpath(repo.mainCheckout) },
      error: null,
    })
    expect(await client.resolveRepo({ path: worktree })).toMatchObject({
      data: { identity, checkoutRoot: await realpath(worktree) },
      error: null,
    })
  })

  test.each([
    ['a plain folder', 'NOT_A_REPO', (dir: string): string => join(dir, 'plain')],
    ['a missing folder', 'PATH_NOT_FOUND', (dir: string): string => join(dir, 'missing')],
    ['a WSL path', 'WSL_UNSUPPORTED', (): string => '\\\\wsl$\\Ubuntu\\home\\dev\\repo'],
  ])('reports %s as %s, carrying the path', async (_case, code, pathIn) => {
    await mkdir(join(repo.dir, 'plain'))
    // Keeps git from finding a repo above the temp dir, such as a dotfiles repo in the home folder.
    vi.stubEnv('GIT_CEILING_DIRECTORIES', repo.dir)
    const path = pathIn(repo.dir)

    const { error } = await connectWorkspace().resolveRepo({ path })

    assert(isDefinedError(error))
    expect([error.code, error.data]).toEqual([code, { code, path }])
  })
})
