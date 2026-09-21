import { describe, expect, it } from 'vitest'
import { MINIMUM_GIT_VERSION } from '@/shared/contract/git'
import { checkGitVersion, parseGitVersion } from './git-version'

const { major, minor } = MINIMUM_GIT_VERSION

describe('parseGitVersion', () => {
  it.each([
    ['plain', 'git version 2.45.1\n', { major: 2, minor: 45, patch: 1 }],
    ['Windows', 'git version 2.45.1.windows.1\n', { major: 2, minor: 45, patch: 1 }],
    ['Apple', 'git version 2.39.3 (Apple Git-146)\n', { major: 2, minor: 39, patch: 3 }],
  ])('reads major, minor and patch from %s git output', (_format, stdout, version) => {
    expect(parseGitVersion(stdout)).toEqual({ data: version, error: null })
  })

  it.each([
    ['no output at all', ''],
    ['an error message in place of a version', 'git: command not found'],
    ['a version missing its patch number', 'git version 2.45'],
    ['a patch number that is not a number', 'git version 2.45.1a'],
  ])('reports %s as GIT_VERSION_UNRECOGNIZED, keeping the output for the message', (_case, stdout) => {
    expect(parseGitVersion(stdout)).toEqual({ data: null, error: { code: 'GIT_VERSION_UNRECOGNIZED', output: stdout } })
  })
})

describe('checkGitVersion', () => {
  it.each([
    ['that is one minor behind the minimum', { major, minor: minor - 1, patch: 3 }],
    ['that is a whole major behind the minimum', { major: major - 1, minor: 99, patch: 0 }],
  ])('rejects a version %s as GIT_TOO_OLD, reporting the version it found', (_case, version) => {
    expect(checkGitVersion(version)).toEqual({ data: null, error: { code: 'GIT_TOO_OLD', version } })
  })

  it.each([
    ['that is exactly the minimum', { major, minor, patch: 0 }],
    ['that is a whole major ahead of the minimum', { major: major + 1, minor: 0, patch: 0 }],
  ])('accepts a version %s and passes it through', (_case, version) => {
    expect(checkGitVersion(version)).toEqual({ data: version, error: null })
  })
})
