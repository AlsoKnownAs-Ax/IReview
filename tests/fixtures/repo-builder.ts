import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const FIXED_DATE = '2026-01-01T00:00:00Z'

export type TempRepo = {
  /** The temp directory holding the Main checkout, linked Worktrees and the empty global git config. */
  dir: string
  /** The Main checkout, on branch `main` with one commit. */
  main: string
  /** Runs git in `cwd` (the Main checkout by default) with the isolated config and resolves to its stdout. */
  git: (args: string[], cwd?: string) => Promise<string>
  /** Adds a linked Worktree on a new branch `name` at `<dir>/worktrees/<name>` and returns its path. */
  addWorktree: (name: string) => Promise<string>
  cleanup: () => Promise<void>
}

/** Builds a temp repo whose git ignores the user's and system config and uses a fixed author and dates (SPEC §8). */
export async function buildRepo(): Promise<TempRepo> {
  const dir = await mkdtemp(join(tmpdir(), 'ireview-repo-'))
  const main = join(dir, 'main')
  const globalConfig = join(dir, 'gitconfig')
  await writeFile(globalConfig, '')
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'IReview Test',
    GIT_AUTHOR_EMAIL: 'test@ireview.invalid',
    GIT_AUTHOR_DATE: FIXED_DATE,
    GIT_COMMITTER_NAME: 'IReview Test',
    GIT_COMMITTER_EMAIL: 'test@ireview.invalid',
    GIT_COMMITTER_DATE: FIXED_DATE,
  }
  const git = async (args: string[], cwd = main): Promise<string> =>
    (await execFileAsync('git', args, { cwd, env, encoding: 'utf8' })).stdout

  await git(['init', '--initial-branch=main', main], dir)
  await writeFile(join(main, 'README.md'), '# Fixture\n')
  await git(['add', 'README.md'])
  await git(['commit', '--message', 'Initial commit'])

  return {
    dir,
    main,
    git,
    async addWorktree(name): Promise<string> {
      const path = join(dir, 'worktrees', name)
      await git(['worktree', 'add', '-b', name, path])
      return path
    },
    cleanup: (): Promise<void> => rm(dir, { recursive: true, force: true, maxRetries: 3 }),
  }
}
