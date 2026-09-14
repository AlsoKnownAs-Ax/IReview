# One git worktree per Session, stored outside the repo

Each Session gets its own git worktree and branch, created from a Base ref. Running in the Main checkout is opt-in. This lets agents run in parallel without overwriting each other's files, and gives every Session a clean diff against its base for review. Worktrees live at `~/.ireview/wt/<repo>/<session>` with short names, not inside the repo:

- File watchers, search and test runners would otherwise pick up nested worktrees.
- Deep `node_modules` paths hit the Windows MAX_PATH limit.

## Considered Options

- **Shared checkout**: rejected, because agents clobber each other and their diffs are mixed together.
- **`.ireview/worktrees/` inside the repo**: rejected, because tooling picks it up by mistake.
- **`../<repo>.worktrees/` next to the repo**: rejected, because it clutters the user's source folder and paths get longer.

## Consequences

- Each worktree has to be prepared (dependencies, ignored files like `.env`), which is why the per-repo Setup script exists.
- A branch can only be checked out in one worktree at a time, so Integrate runs in the Main checkout and is refused when that checkout is dirty or not on the base.
