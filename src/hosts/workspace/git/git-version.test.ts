import { describe, expect, it } from 'vitest'
import { checkGitVersion, parseGitVersion } from './git-version'

describe('parseGitVersion', () => {
  it.each([
    ['plain', 'git version 2.45.1\n'],
    ['Windows', 'git version 2.45.1.windows.1\n'],
  ])('reads a %s version', (_platform, stdout) => {
    expect(parseGitVersion(stdout)).toEqual({ data: { major: 2, minor: 45, patch: 1 }, error: null })
  })

  it('reads an Apple version', () => {
    expect(parseGitVersion('git version 2.39.3 (Apple Git-146)\n')).toEqual({
      data: { major: 2, minor: 39, patch: 3 },
      error: null,
    })
  })

  it.each(['', 'git: command not found', 'git version 2.45', 'git version 2.45.1a'])('rejects %j', (stdout) => {
    expect(parseGitVersion(stdout)).toEqual({ data: null, error: { code: 'GIT_VERSION_UNRECOGNIZED', output: stdout } })
  })
})

describe('checkGitVersion', () => {
  it.each([
    { major: 2, minor: 39, patch: 3 },
    { major: 1, minor: 99, patch: 0 },
  ])('rejects $major.$minor.$patch as too old', (version) => {
    expect(checkGitVersion(version)).toEqual({ data: null, error: { code: 'GIT_TOO_OLD', version } })
  })

  it.each([
    { major: 2, minor: 40, patch: 0 },
    { major: 3, minor: 0, patch: 0 },
  ])('accepts $major.$minor.$patch', (version) => {
    expect(checkGitVersion(version)).toEqual({ data: version, error: null })
  })
})
