import { MINIMUM_GIT_VERSION, type GitVersion, type GitVersionError } from '@shared/contract/workspace'
import type { Result } from '@shared/result'
import { runGit } from './run-git'

// Plain `git version 2.45.1`, Windows `2.45.1.windows.1`, Apple `2.39.3 (Apple Git-146)`.
const VERSION_OUTPUT = /^git version (\d+)\.(\d+)\.(\d+)\b/

/** The system git's version, if it starts, reports one and is new enough. */
export async function detectGitVersion(): Promise<Result<GitVersion, GitVersionError>> {
  const { data: stdout, error } = await runGit(['--version'])
  if (error) return { data: null, error }
  const { data: version, error: parseError } = parseGitVersion(stdout)
  if (parseError) return { data: null, error: parseError }
  return checkGitVersion(version)
}

/**
 * Reads the version from `git --version` output. The one human-readable git output parsed (ADR-0005 otherwise asks
 * for porcelain), because `--version` has no machine-readable form.
 */
export function parseGitVersion(
  stdout: string,
): Result<GitVersion, Extract<GitVersionError, { code: 'GIT_VERSION_UNRECOGNIZED' }>> {
  const [, major, minor, patch] = VERSION_OUTPUT.exec(stdout.trim()) ?? []
  if (!major || !minor || !patch) return { data: null, error: { code: 'GIT_VERSION_UNRECOGNIZED', output: stdout } }
  return { data: { major: Number(major), minor: Number(minor), patch: Number(patch) }, error: null }
}

/** Accepts `MINIMUM_GIT_VERSION` or newer. */
export function checkGitVersion(
  version: GitVersion,
): Result<GitVersion, Extract<GitVersionError, { code: 'GIT_TOO_OLD' }>> {
  const { major, minor } = MINIMUM_GIT_VERSION
  if (version.major > major) return { data: version, error: null }
  if (version.major === major && version.minor >= minor) return { data: version, error: null }
  return { data: null, error: { code: 'GIT_TOO_OLD', version } }
}
