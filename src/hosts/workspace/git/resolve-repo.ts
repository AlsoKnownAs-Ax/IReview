import { realpath, stat } from 'node:fs/promises'
import type { GitRunError, ResolvedRepo, ResolveRepoError, ResolveRepoInput } from '../../../shared/contract/workspace'
import type { Result } from '../../../shared/rpc/contract'
import { runGit } from './run-git'

// Git ≥ 2.31 prints each requested path absolute, one per line, in argument order.
const REV_PARSE_ARGS = [
  '--no-optional-locks',
  'rev-parse',
  '--path-format=absolute',
  '--git-common-dir',
  '--show-toplevel',
]

// Git dies with exit 128 for any fatal error (dubious ownership, corrupt repo, …), so the message tells "no repo here"
// apart. `LC_ALL=C` keeps that message untranslated.
const UNTRANSLATED = { LC_ALL: 'C' }
const NOT_A_REPO_EXIT_CODE = 128
const NOT_A_REPO_MESSAGE = 'not a git repository'

/** The Repo a folder belongs to, identified by the real path of its git common dir (SPEC §3.1). */
export async function resolveRepo({ path }: ResolveRepoInput): Promise<Result<ResolvedRepo, ResolveRepoError>> {
  if (isWslPath(path)) return { data: null, error: { code: 'WSL_UNSUPPORTED', path } }
  // Checked before git: a missing `cwd` would otherwise report `GIT_MISSING`.
  if (!(await isFolder(path))) return { data: null, error: { code: 'PATH_NOT_FOUND', path } }
  const { data: stdout, error } = await runGit(REV_PARSE_ARGS, { cwd: path, env: UNTRANSLATED })
  if (error && isNotARepo(error)) return { data: null, error: { code: 'NOT_A_REPO', path } }
  if (error) return { data: null, error }
  const [commonDir = '', checkoutRoot = ''] = stdout.split('\n')
  // `realpath` resolves symlinks and Windows 8.3 short names, so the same Repo always compares equal.
  return { data: { identity: await realpath(commonDir), checkoutRoot: await realpath(checkoutRoot) }, error: null }
}

function isFolder(path: string): Promise<boolean> {
  return stat(path).then(
    (stats): boolean => stats.isDirectory(),
    (): boolean => false,
  )
}

function isNotARepo(error: GitRunError): boolean {
  if (error.code !== 'GIT_FAILED') return false
  return error.exitCode === NOT_A_REPO_EXIT_CODE && error.stderr.includes(NOT_A_REPO_MESSAGE)
}

// `\\wsl$\<distro>` and `\\wsl.localhost\<distro>` in either slash style, any case (SPEC §3.1).
const WSL_PATH = /^[\\/]{2}wsl(\$|\.localhost)([\\/]|$)/i

/** Whether `path` is inside WSL, which IReview refuses before running git. */
export function isWslPath(path: string): boolean {
  return WSL_PATH.test(path)
}
