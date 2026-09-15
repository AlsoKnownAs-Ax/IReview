import { execFile, type ExecFileException } from 'node:child_process'
import type { GitRunError } from '../../../shared/contract/workspace'
import type { Result } from '../../../shared/rpc/contract'

export type GitRunOptions = {
  /** Must exist: a missing `cwd` fails to spawn just like a missing git, so it also reports `GIT_MISSING`. */
  cwd?: string
  /** The binary to start; the system `git` on `PATH` unless a test overrides it. */
  executable?: string
  /** Variables set on top of the inherited environment. */
  env?: Record<string, string>
}

/** Runs the system git with `args`, no shell, and resolves to its stdout (ADR-0005). Never rejects. */
export function runGit(
  args: string[],
  { cwd, executable = 'git', env }: GitRunOptions = {},
): Promise<Result<string, GitRunError>> {
  const options = { cwd, env: { ...process.env, ...env }, encoding: 'utf8', windowsHide: true } as const
  return new Promise((resolve): void => {
    execFile(executable, args, options, (error, stdout, stderr): void => {
      if (error) return resolve({ data: null, error: toGitRunError(error, stderr) })
      resolve({ data: stdout, error: null })
    })
  })
}

function toGitRunError(error: ExecFileException, stderr: string): GitRunError {
  // A process that never started fails in the `spawn` syscall (ENOENT, EACCES); anything later is git's own failure.
  if (error.syscall?.startsWith('spawn')) return { code: 'GIT_MISSING' }
  return { code: 'GIT_FAILED', exitCode: exitCodeOf(error), stderr }
}

/** Absent when git was killed or its output overflowed instead of exiting. */
function exitCodeOf({ code }: ExecFileException): number | undefined {
  if (typeof code === 'number') return code
  return undefined
}
