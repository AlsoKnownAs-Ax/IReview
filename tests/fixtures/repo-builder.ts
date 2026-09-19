import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** Used as both author and committer, so every commit is reproducible. */
const AUTHOR = { name: 'IReview Test', email: 'test@ireview.invalid', date: '2026-01-01T00:00:00Z' }

export type TempRepo = {
  /** The temp directory holding the Main checkout, linked Worktrees and the empty global git config. */
  dir: string
  /** The Main checkout, on branch `main` with one commit. */
  mainCheckout: string
  /** Adds a linked Worktree on a new branch `name` at `<dir>/worktrees/<name>` and returns its path. */
  addWorktree: (name: string) => Promise<string>
  cleanup: () => Promise<void>
}

/** Builds a temp repo whose git ignores the user's and system config and uses a fixed author and dates (SPEC §8). */
export async function buildRepo(): Promise<TempRepo> {
  const dir = await mkdtemp(join(tmpdir(), 'ireview-repo-'))
  const mainCheckout = join(dir, 'main')
  const globalConfig = join(dir, 'gitconfig')
  await writeFile(globalConfig, '')
  const env = {
    // Drops inherited `GIT_DIR` and the like (set when tests run from a git hook), which would redirect every call.
    ...Object.fromEntries(Object.entries(process.env).filter(([name]): boolean => !name.startsWith('GIT_'))),
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: AUTHOR.name,
    GIT_AUTHOR_EMAIL: AUTHOR.email,
    GIT_AUTHOR_DATE: AUTHOR.date,
    GIT_COMMITTER_NAME: AUTHOR.name,
    GIT_COMMITTER_EMAIL: AUTHOR.email,
    GIT_COMMITTER_DATE: AUTHOR.date,
  }
  const git = async (args: string[], cwd = mainCheckout): Promise<void> => {
    await execFileAsync('git', args, { cwd, env })
  }

  await git(['init', '--initial-branch=main', mainCheckout], dir)
  await writeFile(join(mainCheckout, 'README.md'), '# Fixture\n')
  await git(['add', 'README.md'])
  await git(['commit', '--message', 'Initial commit'])

  return {
    dir,
    mainCheckout,
    async addWorktree(name): Promise<string> {
      const path = join(dir, 'worktrees', name)
      await git(['worktree', 'add', '-b', name, path])
      return path
    },
    cleanup: (): Promise<void> => rm(dir, { recursive: true, force: true, maxRetries: 3 }),
  }
}
