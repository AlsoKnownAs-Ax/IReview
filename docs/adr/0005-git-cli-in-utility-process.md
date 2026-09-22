# Git via the system `git` CLI in a utility process

All git operations call the user's system `git` (version 2.40 or newer, not bundled) from the per-window workspace host. They parse only machine-readable output (porcelain v2, `-z`) and keep a long-lived `cat-file --batch` process for reading blobs. The CLI is the only option with full worktree support that behaves exactly like the git the user's agents are already running: same config, hooks, credential helpers, LFS and filters.

## Considered Options

- **isomorphic-git**: rejected. No worktree support, and slow on large repos.
- **nodegit / libgit2 bindings**: rejected. They lag git's features, add another native module to rebuild for Electron, and ignore parts of the user's git config.
- **dugite (bundled git)**: rejected. It would behave differently from the git the user's agents run in the same worktree.

## Consequences

- Starting processes is slow on Windows, so the host reuses long-lived git processes where it can.
- Agents run git in the same worktrees, so read commands use `--no-optional-locks` to avoid fighting over `index.lock`.
- Two outputs have no machine-readable form and are parsed as text: `git --version`, and the newline-separated paths
  of `rev-parse --git-common-dir --show-toplevel`. "Not a repository" has no exit code of its own, so it is told
  apart by its message under `LC_ALL=C`.
