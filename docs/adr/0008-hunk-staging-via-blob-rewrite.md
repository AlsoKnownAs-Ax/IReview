# Hunk staging by rewriting the index blob, not `git apply`

To stage or unstage a hunk, the app:

1. Reads the file's index version in working-tree form (`git cat-file --filters`).
2. Applies the selected diff changes with a pure `applyLineChanges` function.
3. Writes the result back with `git hash-object -w --path=<p>` and `git update-index --cacheinfo`.

Generating patches for `git apply --cached` breaks on stale context, CRLF conversion and filtered files such as LFS. This route applies the repo's clean filters and never depends on patch context.

## Consequences

- `applyLineChanges` is the one piece of logic every staging operation goes through, so it is fuzz-tested against a `git apply` oracle.
- Staging reads the saved file, not unsaved edits in the editor.
- LFS files and submodules don't support hunk staging; they stage whole.
- Reverting a hunk is a plain text edit to the working file, not a git operation, so it can be undone while the file is open.
