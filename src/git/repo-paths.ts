import type { GitRunError } from '@/shared/contract/git'
import type { Result } from '@/shared/result'
import { runGit } from './run-git'

export type RepoPaths = {
  /** Absolute path of the git common dir, shared by the Main checkout and its linked Worktrees. */
  commonDir: string
  /** Absolute path of the Main checkout or linked Worktree holding `cwd`. */
  checkoutRoot: string
}

export type NotARepoError = { code: 'NOT_A_REPO'; path: string }

// Git ≥ 2.31 prints each requested path absolute, one per line, in argument order. `rev-parse` has no `-z`, so this is
// the second exception to ADR-0005's machine-readable output, after `--version`.
const REV_PARSE_ARGS = [
  '--no-optional-locks',
  'rev-parse',
  '--path-format=absolute',
  '--git-common-dir',
  '--show-toplevel',
]

// Git has no coded "not a repository" failure. It exits 128 for every fatal error (dubious ownership, corrupt repo, …),
// so only the message tells "no repo here" apart. `LC_ALL=C` keeps that message untranslated.
const C_LOCALE_ENV = { LC_ALL: 'C' }
const NOT_A_REPO_EXIT_CODE = 128
const NOT_A_REPO_MESSAGE = 'not a git repository'

/** Asks git which repo holds the folder `cwd`, which must exist (a missing one reports `GIT_MISSING`). */
export async function readRepoPaths({
  cwd,
  executable,
}: {
  cwd: string
  executable?: string
}): Promise<Result<RepoPaths, GitRunError | NotARepoError>> {
  const { data: stdout, error } = await runGit(REV_PARSE_ARGS, { cwd, executable, env: C_LOCALE_ENV })

  if (error && isNotARepo(error)) {
    return { data: null, error: { code: 'NOT_A_REPO', path: cwd } }
  }

  if (error) {
    return { data: null, error }
  }

  const [commonDir = '', checkoutRoot = ''] = stdout.split('\n', 2)

  return { data: { commonDir, checkoutRoot }, error: null }
}

function isNotARepo(error: GitRunError): boolean {
  if (error.code !== 'GIT_FAILED') {
    return false
  }

  return error.exitCode === NOT_A_REPO_EXIT_CODE && error.stderr.includes(NOT_A_REPO_MESSAGE)
}
