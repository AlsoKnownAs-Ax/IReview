import { execFile, type ExecFileException } from 'node:child_process'
import type { Result } from '../../../shared/rpc/contract'

export type GitRunError = { code: 'GIT_MISSING' } | { code: 'GIT_FAILED'; exitCode?: number; stderr: string }

export type GitRunOptions = {
  cwd?: string
  /** The binary to start; the system `git` on `PATH` unless overridden. */
  executable?: string
}

/** Runs the system git with `args`, no shell, and resolves to its stdout (ADR-0005). Never rejects. */
export function runGit(
  args: string[],
  { cwd, executable = 'git' }: GitRunOptions = {},
): Promise<Result<string, GitRunError>> {
  return new Promise((resolve) => {
    execFile(executable, args, { cwd, encoding: 'utf8', windowsHide: true }, (error, stdout, stderr): void => {
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
