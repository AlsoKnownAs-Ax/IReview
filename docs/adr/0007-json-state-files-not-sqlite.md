# App state in versioned JSON files, not SQLite

Local state lives in JSON documents under `~/.ireview/`: sessions, per-session layouts, viewed flags, local comments and terminal metadata. Each file carries a `schemaVersion` and migrations and is written atomically. The data is small, each repo has a single writer (its window, enforced by the registry and a lockfile), people can open and read it, and no native module is added.

## Considered Options

- **SQLite (better-sqlite3)**: rejected for v1. It would be another native module to rebuild per Electron version and architecture, for data that needs no queries or concurrent writers.

## Consequences

Revisit if any of these appear: cross-repo queries, large per-repo history such as a review log, or more than one process writing the same repo's state.
