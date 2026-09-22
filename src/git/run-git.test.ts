import type { ExecFileException } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { runGit, toGitRunError } from './run-git'

describe('runGit', () => {
  it('reports a git binary that cannot be started as missing', async () => {
    expect(await runGit(['--version'], { executable: 'ireview-no-such-git' })).toEqual({
      data: null,
      error: { code: 'GIT_MISSING' },
    })
  })

  it('reports a git that exits non-zero with its exit code and stderr', async () => {
    const { error } = await runGit(['ireview-no-such-command'])

    expect(error).toEqual({
      code: 'GIT_FAILED',
      exitCode: 1,
      stderr: expect.stringContaining('ireview-no-such-command'),
    })
  })
})

describe('toGitRunError', () => {
  it.each(['ENOENT', 'EACCES'])('reports a spawn that fails with %s as missing git', (code) => {
    const error = Object.assign(new Error(code), { code, syscall: 'spawn git' }) satisfies ExecFileException

    expect(toGitRunError(error, '')).toEqual({ code: 'GIT_MISSING' })
  })

  it('reports a killed git without an exit code, unlike one that exited non-zero', () => {
    const killed = Object.assign(new Error('killed'), { code: null, killed: true, signal: 'SIGTERM' as const })
    const exited = Object.assign(new Error('exited'), { code: 128 })

    expect(toGitRunError(killed, 'partial')).toEqual({ code: 'GIT_FAILED', exitCode: undefined, stderr: 'partial' })
    expect(toGitRunError(exited, 'fatal')).toEqual({ code: 'GIT_FAILED', exitCode: 128, stderr: 'fatal' })
  })
})
