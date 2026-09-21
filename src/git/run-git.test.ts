import { describe, expect, it } from 'vitest'
import { runGit } from './run-git'

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
