import type { ResolvedRepo } from '@/repo/contract'

/** What the registry asks of a Window: focus, and word of its closing. A `BrowserWindow` is one. */
export type RepoWindow = { focus(): void; on(event: 'closed', listener: () => void): unknown }

export type RepoRegistryOptions = {
  /** Opens a Window bound to `repo`. Creating Windows stays with `app`, so this module never imports it. */
  createWindow: (repo: ResolvedRepo) => RepoWindow
}

export type RepoRegistry = {
  /** Opens a Window for `repo`, or focuses the one already open for its identity, which its Worktrees share. */
  open(repo: ResolvedRepo): void
}

/** The Repo → Window registry, keyed by identity (SPEC §3.1, ADR-0006). A Window leaves it when it closes. */
export function createRepoRegistry({ createWindow }: RepoRegistryOptions): RepoRegistry {
  const windows = new Map<string, RepoWindow>()

  return {
    open(repo): void {
      const open = windows.get(repo.identity)

      if (open) {
        return open.focus()
      }

      const window = createWindow(repo)
      windows.set(repo.identity, window)
      window.on('closed', () => windows.delete(repo.identity))
    },
  }
}
