import type { RepoPathsError } from '@/shared/contract/git'
import type { Result } from '@/shared/result'
import { readGit } from './run-git'

export type RepoPaths = {
  /** Absolute path of the git common dir, shared by the Main checkout and its linked Worktrees. */
  commonDir?: string
  /** Absolute path of the Main checkout or linked Worktree holding `cwd`. */
  checkoutRoot?: string
}

// Each requested path absolute, one per line, in argument order. `rev-parse` has no `-z` (ADR-0005).
const REV_PARSE_ARGS = ['rev-parse', '--path-format=absolute', '--git-common-dir', '--show-toplevel']

// Git has no coded "not a repository" failure. It exits 128 for every fatal error (dubious ownership, corrupt repo, …),
// so only its message, untranslated under `readGit`'s C locale, tells "no repo here" apart (ADR-0005).
const NOT_A_REPO_EXIT_CODE = 128
const NOT_A_REPO_MESSAGE = 'not a git repository'

/** Asks git which repo holds the folder `cwd`, which must exist (a missing one reports `GIT_MISSING`). */
export async function readRepoPaths({ cwd }: { cwd: string }): Promise<Result<RepoPaths, RepoPathsError>> {
  const { data: stdout, error } = await readGit(REV_PARSE_ARGS, { cwd })

  if (error && isNotARepo(error)) {
    return { data: null, error: { code: 'NOT_A_REPO', path: cwd } }
  }

  if (error) {
    return { data: null, error }
  }

  // An empty line is no path; `realpath('')` would resolve to the process's own cwd.
  const [commonDir, checkoutRoot] = stdout.split('\n', 2).map((line): string | undefined => line || undefined)

  return { data: { commonDir, checkoutRoot }, error: null }
}

function isNotARepo(error: RepoPathsError): boolean {
  if (error.code !== 'GIT_FAILED') {
    return false
  }

  return error.exitCode === NOT_A_REPO_EXIT_CODE && error.stderr.includes(NOT_A_REPO_MESSAGE)
}
