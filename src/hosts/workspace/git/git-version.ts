import type { GitVersion, GitVersionError } from '../../../shared/contract/workspace'
import type { Result } from '../../../shared/rpc/contract'
import { runGit } from './run-git'

/** The system git's version, if it starts, reports one and is new enough. */
export async function detectGitVersion(): Promise<Result<GitVersion, GitVersionError>> {
  const { data: stdout, error } = await runGit(['--version'])
  if (error) return { data: null, error }
  const { data: version, error: parseError } = parseGitVersion(stdout)
  if (parseError) return { data: null, error: parseError }
  return checkGitVersion(version)
}

// Plain `git version 2.45.1`, Windows `2.45.1.windows.1`, Apple `2.39.3 (Apple Git-146)`.
const VERSION_OUTPUT = /^git version (\d+)\.(\d+)\.(\d+)\b/

/** Reads the version from `git --version` output. */
export function parseGitVersion(
  stdout: string,
): Result<GitVersion, Extract<GitVersionError, { code: 'GIT_VERSION_UNRECOGNIZED' }>> {
  const [, major, minor, patch] = VERSION_OUTPUT.exec(stdout.trim()) ?? []
  if (!major || !minor || !patch) return { data: null, error: { code: 'GIT_VERSION_UNRECOGNIZED', output: stdout } }
  return { data: { major: Number(major), minor: Number(minor), patch: Number(patch) }, error: null }
}

/** Accepts git 2.40 or newer (ADR-0005). */
export function checkGitVersion(
  version: GitVersion,
): Result<GitVersion, Extract<GitVersionError, { code: 'GIT_TOO_OLD' }>> {
  if (version.major > 2) return { data: version, error: null }
  if (version.major === 2 && version.minor >= 40) return { data: version, error: null }
  return { data: null, error: { code: 'GIT_TOO_OLD', version } }
}
