# IReview — Specification

Status: v1 specification, agreed 2026-09-14. Vocabulary follows [`CONTEXT.md`](../CONTEXT.md); architectural
decisions are recorded in [`docs/adr/`](./adr/). Visual language follows [`DESIGN.md`](../DESIGN.md).

## 1. Purpose

IReview is a Windows + macOS desktop app whose primary job is **reviewing code — with editing — while coding agents
run in parallel beside it**. A developer opens a Repo, starts Sessions (isolated Worktrees), runs agent CLIs in
Zed-style Terminal Panes, reviews each Session's changes or a teammate's Pull request, and sends Feedback straight back
into a Terminal — without leaving the app.

**Product intent:** open source (MIT), built personal-first. No telemetry; local rotating logs only.

### Goals (v1)

- Review local changes and agent output per Session, file by file, and act on them (stage, revert, comment, commit, Integrate).
- Review GitHub Pull requests end to end: read, comment, suggest, resolve, submit — and pull them into a PR session.
- Run any number of Terminals in a flexible Layout, per Session, restored across restarts.
- Edit code comfortably (Monaco, no language servers).

### Non-goals (v1)

- Agent model: no agent profiles, status detection, notifications or ACP integration ([ADR-0003](./adr/0003-terminal-native-agents-no-agent-model-v1.md)).
- Creating or merging Pull requests; providers other than GitHub.
- Language servers (go-to-definition, hover, diagnostics), debugger, extensions.
- Multi-repo Windows; repos located inside WSL; non-git folders.
- Stacked multi-file diff view; three-way merge tool; light theme.
- Code signing, notarization, auto-update.

## 2. Decisions

| # | Topic | Decision |
|---|-------|----------|
| D1 | Stack | Electron + TypeScript + React 19; Monaco (editor + diff); node-pty ([ADR-0001](./adr/0001-electron-over-tauri-gpui-zed-fork.md)) |
| D2 | Review targets | Agent output and local changes (Session vs Base ref) and GitHub Pull requests |
| D3 | Agent integration | Terminal-native; seam kept for agent profiles / ACP later |
| D4 | Product intent | Open source (MIT), personal-first; no telemetry |
| D5 | Isolation | Worktree + branch per Session by default; opt-in to use the Main checkout; per-repo Setup script ([ADR-0004](./adr/0004-worktree-per-session-outside-repo.md)) |
| D6 | Window model | One Repo per Window |
| D7 | GitHub auth | GitHub only behind a provider interface; `gh auth token` (read each launch, never persisted), else OAuth device flow with the token encrypted via Electron `safeStorage` |
| D8 | Pull request features | Read, Write review, PR session loop (§6.7). Not v1: create or merge Pull requests |
| D9 | Editing | Monaco without LSP; TextMate-grade highlighting, multi-cursor, find/replace, file tree, quick open, project search |
| D10 | Layout & config | Zed-like split tree of Panes + Docks; Terminal profiles and Layout presets in global + per-repo JSON, editable in UI |
| D11 | Opening folders | Each folder opens a new Window; git repos only (offer `git init`); already-open Repo focuses its Window; a linked Worktree folder opens its Repo's Window with that Session focused |
| D12 | Session | Worktree + branch + Base ref, any number of Terminals; Main checkout is a permanent Session; PR session is a Session |
| D13 | Agent status | None in v1 |
| D14 | Diff presentation | Changed-file list + one Monaco diff (side-by-side / inline); next/previous file and hunk |
| D15 | Local diff actions | Viewed, revert hunk, stage/unstage hunk, Local comments |
| D16 | Feedback | Comments formatted into one sanitized prompt, bracketed-pasted into the Session's last-focused Terminal (switchable); never auto-submitted |
| D17 | Git scope | Commit, push, pull, fetch, Integrate (merge / squash / rebase), Archive, Discard |
| D18 | Tooling | pnpm, electron-vite, TS strict, Tailwind v4, Zustand, system `git` CLI ≥ 2.40 ([ADR-0005](./adr/0005-git-cli-in-utility-process.md)), Octokit REST + GraphQL, Vitest, Playwright (Electron), electron-builder |
| D19 | Design | Extend `DESIGN.md` with an App section; dark only |
| D20 | Agents in v1 | Users run agent CLIs in plain Terminals |
| D21 | Persistence | Full restore of Layouts, Sessions, Terminals and scrollback history |
| D22 | Local comments | Stick to line numbers; deleted once sent as Feedback |
| D23 | Keybindings | Command palette + Zed-style default keymap with JSON overrides |
| D24 | Packaging | Unsigned CI builds on GitHub Releases (macOS arm64 + x64, Windows x64) |
| D25 | Pull request sync | Focus-aware polling with ETags |
| D26 | Concurrent edits | Clean buffers reload; dirty buffers get a conflict banner; no autosave |
| D27 | Windows platform | PowerShell 7 default shell; WSL repos unsupported |
| D28 | Terminal library | xterm.js behind `TerminalRenderer`; Ghostty spike after M2 ([ADR-0002](./adr/0002-xterm-behind-renderer-interface-ghostty-deferred.md)) |
| D29 | Milestones | M0 → M6, local review loop before GitHub (§10) |
| D30 | Conflicts | Minimal Conflict handling in v1; JetBrains-style merge tool later |
| D31 | Diff mode defaults | Session: Since base; Main checkout: Uncommitted |
| D32 | Spec location | This file + `CONTEXT.md` + ADRs |
| D33 | Layout scope | Per Session for center and Terminal Dock; left Dock shared |
| D34 | Inbox scope | Current Window's Repo only |

Items marked **(default)** below were not explicitly debated; they are the working choice and may be revisited
without an ADR unless they turn out to be hard to reverse.

## 3. Functional specification

### 3.1 Windows and Repos

- Launch shows a welcome Window (recent Repos, Open Folder).
- Opening a folder:
  - not a git repo → prompt to run `git init`, otherwise refuse;
  - Repo already open → focus that Window;
  - a linked Worktree of a known Repo → open (or focus) the Repo's Window with that Session focused;
  - otherwise → new Window. Existing Windows keep running.
- Repo identity is the real path of its git common directory.
- Repos located inside WSL (`\\wsl$\…`) are refused with an explanation.
- Quitting or closing a Window while Terminals have running child processes asks for confirmation.

### 3.2 Sessions

- The **Main checkout** is always listed as a Session.
- **New Session** dialog: name (validated as a branch name; branch `ireview/<slug>` **(default)**), Base ref picker
  (local and remote branches; fetches first), Layout preset, and "use Main checkout instead" opt-in.
- Creation: `git worktree add` at `~/.ireview/wt/<repo-slug>/<session-slug>` (slugs ≤ 24 chars, collision suffix),
  then copies configured ignored files (e.g. `.env*`) and runs the **Setup script** in a visible Terminal.
  A Setup script from repo config requires a one-time trust prompt per content hash **(default)**.
- Branch already checked out in another Worktree → actionable error offering to open that Session.
- **Archive** removes the Worktree and keeps the branch; **Discard** removes both, warning about unpushed or
  unintegrated commits. Both stop the Session's Terminals first; removal retries on Windows file locks.
- Worktrees that are missing, locked or prunable are shown with their state and can be pruned with consent;
  Worktrees created outside the app are listed as Sessions.
- Switching Sessions swaps the center and Terminal-Dock Layout (D33); Terminals of other Sessions keep running.

### 3.3 Workspace and Layout

- **Panes** form a split tree; each Pane holds tabbed **Items** (file, diff, Terminal, Pull request view). Items can
  be dragged between Panes or to an edge to split. Moving an Item never reloads it (undo history, cursor and
  Terminal state survive).
- **Docks:** left (files, git changes, Sessions, Inbox) — shared across Sessions; bottom/right (Terminals, with their
  own splits) — per Session.
- **Layout presets** (e.g. "claude + dev server + tests") define Panes, Items and Terminal profiles to open; they can
  be applied to a new or existing Session.
- Unknown or dangling Items restore as placeholders rather than failing.

### 3.4 Editor

- Monaco with TextMate-grade highlighting (VS Code grammars, loaded per language), multi-cursor, find/replace.
- Virtualized file tree (tracked + untracked, respecting `.gitignore`), quick open (fuzzy, < 100 ms on 50k files),
  project search streaming ripgrep results.
- Save preserves line endings and BOM. UTF-8 (with or without BOM) only; other encodings open read-only **(default)**.
- Files over 5 MB or with very long lines open without highlighting or diff **(default)**.
- **Concurrent edits (D26):** when a file changes on disk (typically an Agent), a buffer without unsaved edits reloads
  silently; a buffer with unsaved edits shows a banner: **Compare**, **Keep mine** (overwrite disk), **Take theirs**.
  No autosave.
- A registration point for language features exists so LSP can be added in v2.

### 3.5 Terminals

- Terminals are Items running a shell in the Session's Worktree. Any number per Session.
- **Terminal profiles:** name, shell, args, cwd (relative to Worktree), env, optional startup command.
  Auto-detected profiles: macOS login shell; Windows PowerShell 7 → Windows PowerShell (default), Git Bash, WSL
  distributions.
- On macOS the login-shell environment is resolved at startup so CLIs such as `claude` and `codex` are on `PATH`.
- Rendering via xterm.js (WebGL with DOM fallback) behind `TerminalRenderer` (D28): search, clickable links,
  `file:line` links open in the editor, theme from design tokens.
- The focused Terminal receives all keys except a small set of reserved app chords (so `Ctrl+C`, `Ctrl+R` etc. reach
  the shell).
- Killing a Terminal terminates its whole process tree.
- Terminals survive renderer reloads and crashes (re-attach without losing output).

### 3.6 Local review

- **Diff mode (D31):**
  - Session: *Since base* = merge-base(Base ref, HEAD) → working tree including untracked files; toggle to *Uncommitted*.
  - Main checkout: *Uncommitted* = HEAD → working tree; toggle to compare with `origin/<default-branch>`.
- Changed-file list shows status (added, modified, deleted, renamed, binary, submodule, untracked) and Viewed state.
- One Monaco diff per file, side-by-side or inline; keys for next/previous file and hunk.
- The modified side is the live editor model, so edits made during Review are immediate **(default)**.
- **Viewed:** per-file checkbox; clears automatically when the file's content changes.
- **Revert hunk:** removes that change from the working file (undoable while the file is open). Available in both modes.
- **Stage / unstage hunk:** available in *Uncommitted* mode only; requires the file to be saved **(default)**.
  LFS files and submodules stage whole ([ADR-0008](./adr/0008-hunk-staging-via-blob-rewrite.md)).
- **Local comments (D22):** added on a line or line range; follow line numbers as the reviewer edits in-app; do not
  move for external edits; stored per Session in `~/.ireview/`; never sent to GitHub.
- **Feedback (D16):** "Send to Terminal" gathers selected comments into one prompt —
  `path:line`, a short code excerpt, and the comment — then:
  - target = the Session's last-focused Terminal, switchable from a picker;
  - text is sanitized (escape and control characters stripped), line endings normalized, wrapped in bracketed-paste
    markers only if the Terminal has bracketed paste enabled, chunked on Windows;
  - never followed by Enter — the user submits;
  - over 1,500 characters → written to `.ireview/feedback/<timestamp>.md` in the Worktree and a short pointer prompt
    is pasted instead **(default)**; `.ireview/feedback/` is added to the Worktree's `info/exclude`;
  - sent comments are deleted.

### 3.7 Git operations

- **Commit:** stage all or staged hunks, message editor.
- **Push** (sets upstream on first push), **pull**, **fetch**.
- **Integrate** a Session into its Base ref by merge, squash or rebase:
  - runs in the Main checkout; refused if it is dirty; if it is not on the Base ref, offer to check it out when clean;
  - conflicts are predicted beforehand (`git merge-tree --write-tree`) and shown before starting.
- **Conflict (D30, minimal):** detected state banner, list of conflicted files, markers highlighted in the editor,
  manual resolution, **Continue** / **Abort**. The same UI handles rebase conflicts inside a Session.
  A JetBrains-style merge tool (three panes, per-chunk accept) is planned after v1.
- **Archive / Discard:** see §3.2.

### 3.8 GitHub Pull requests

- **Auth (D7):** use `gh auth token` when `gh` is installed and logged in (read at launch, never stored); otherwise
  OAuth device flow through the project's OAuth App, token encrypted with `safeStorage`.
- **Remote:** `upstream` if `origin` is a fork, else `origin`; overridable in repo config **(default)**.
- **Inbox (D34):** the Window's Repo only; groups *Review requested*, *Authored*, *Involved*.
- **Pull request view:**
  - diff computed from local refs (`pull/<n>/head` fetched to `refs/ireview/pr/<n>`, merge-base with the base) so it
    matches GitHub's diff;
  - per-file layout identical to local Review; Threads shown inline on the correct side and line;
    Outdated threads collected in an **Outdated** panel with their original hunk;
  - CI checks and statuses, read-only;
  - description and comments rendered as markdown without raw HTML.
- **Write review:**
  - comments and multi-line comments on lines within diff hunks; suggested changes (`suggestion` blocks);
  - comments accumulate in the user's **Pending review** (an existing pending review is adopted on open);
  - reply to and resolve / unresolve Threads;
  - submit as Comment, Approve or Request changes (body required); discard pending review;
  - Approve / Request changes disabled on the user's own Pull requests.
- **PR session loop:**
  - "Check out" creates a PR session (branch `pr/<n>`); same-repo Pull requests track their remote branch;
  - Pull requests from forks are read-only for pushing (no push to forks in v1);
  - if the Pull request was force-pushed, offer to reset to the new head (confirm if local commits exist) **(default)**;
  - "Send to Terminal" works on Threads exactly like Local comments (§3.6), without deleting the Threads.
- **Sync (D25):** Inbox polls every ~2 min while the Window is focused, plus manual refresh; an open and visible Pull
  request refreshes Threads and checks every ~30 s; REST calls use ETags; rate-limit and secondary-limit responses
  back off.

### 3.9 Persistence and restore (D21)

- Restored on launch per Repo: Sessions, per-Session Layouts, shared Dock state, Window bounds.
- Terminals are re-spawned with their profile in the last known cwd (reported by the shell), else the initial cwd.
- The last ~1,000 lines of scrollback are replayed as dimmed history above the new prompt, followed by a separator
  and a reset of terminal modes. Full-screen (alternate buffer) content is never stored. Scrollback persistence can be
  turned off in settings because it may contain secrets.
- Scrollback snapshots are taken every 30 s and on quit.
- Viewed flags and Local comments persist per Session.

### 3.10 Commands and keybindings (D23)

- Command palette listing every command; commands have ids, titles and context conditions.
- Default keymap follows Zed's; per-platform variants; chords supported.
- User overrides in `~/.ireview/keymap.json` (Zed keymap format: context + bindings), hot-reloaded.
- Monaco defaults that conflict with app commands are removed.

### 3.11 Design (D19)

- `DESIGN.md` gains an **App** section: prefixed color keys (`diff-*`, `ansi-*`, `syntax-*`, warning/error) that stay
  muted and subordinate to the single lavender accent, and a 13px UI density scale.
- Tokens are generated into CSS variables (Tailwind v4 theme) and a TS module; Monaco and xterm themes derive from them.
- Dark only in v1. Fonts: Inter (UI), JetBrains Mono (code, terminals) as documented substitutes.

## 4. Configuration and state

| File | Scope | Contents |
|------|-------|----------|
| `~/.ireview/settings.json` | Global, JSONC with `$schema` | Terminal profiles, Layout presets, editor/terminal options, scrollback persistence toggle |
| `~/.ireview/keymap.json` | Global, JSONC | Keybinding overrides (Zed format) |
| `<repo>/.ireview/config.json` | Per repo, committed | Setup script (`copy` globs, `command`, `windowsCommand`), Terminal profiles, Layout presets, `github.remote` |
| `~/.ireview/repos/<slug>-<hash8>/config.json` | Per repo, personal | Overrides of the committed config |
| `~/.ireview/state/app.json` | App | Recent Repos, Window bounds, trusted Setup script hashes, slug collisions |
| `~/.ireview/auth.json` | App | Device-flow token ciphertext (`safeStorage`) |
| `~/.ireview/repos/<key>/state.json` | Per repo | Sessions (id, path, branch, Base ref, archived), per-Session Layout, last-focused Terminal |
| `~/.ireview/repos/<key>/review/<sessionId>.json` | Per Session | Viewed flags (path → content hash), Local comments (path → side, line range, excerpt, body) |
| `~/.ireview/repos/<key>/terminals/<id>.json`, `.ansi` | Per Terminal | Profile, cwd, serialized scrollback |
| `~/.ireview/wt/<repo-slug>/<session-slug>/` | Per Session | Worktrees |

- Settings merge order: built-in defaults < global < repo (committed) < personal. Repo config is always read from the
  Main checkout. Invalid edits keep the last valid config and surface an error.
- State documents carry `schemaVersion` with migrations and are written atomically
  ([ADR-0007](./adr/0007-json-state-files-not-sqlite.md)).
- `IREVIEW_HOME` overrides `~/.ireview` (used by tests).

## 5. Architecture

### 5.1 Processes ([ADR-0006](./adr/0006-per-window-utility-hosts.md))

```
main (one): lifecycle, repo→window registry, MessagePort broker, safeStorage, menus, dialogs, supervisor
 ├─ renderer (per Window, sandboxed): React + Zustand UI, Monaco, xterm; coordinates hosts
 ├─ workspace-host (utility, per Window): git CLI, fs, watcher, ripgrep, sessions, repo settings & state
 ├─ pty-host (utility, per Window): node-pty, headless terminal mirrors, flow control, shell detection
 └─ github-host (utility, shared, lazy): Octokit, poller, ETag cache, rate-limit budget
```

- Main loads no native modules. Hosts never call each other; the renderer coordinates.
- Supervisor restarts a crashed workspace-host transparently; a pty-host crash shows a "restart terminal host" banner.
- PTYs outlive renderer reloads: the renderer re-attaches using a snapshot plus sequence number (same path for dev
  hot reload, crash recovery and restore).
- **Hardening:** `contextIsolation`, `sandbox`, no `nodeIntegration`; content served from a custom `app://` protocol;
  strict CSP (`script-src 'self' 'wasm-unsafe-eval'`, no remote connections from the renderer); navigation,
  `window.open` and permission requests denied; external links only via `shell.openExternal` for https; Electron fuses
  (RunAsNode off, NodeOptions off, asar integrity on); markdown rendered without raw HTML.

### 5.2 IPC

- `src/shared/contract/`: one contract per host built from zod schemas; each member is an `rpc` (request → response),
  `stream` (cancellable async iterable) or `event`. Errors are typed codes (e.g. `BRANCH_CHECKED_OUT`,
  `DIRTY_WORKTREE`, `RATE_LIMITED`).
- `src/shared/rpc/`: transport-agnostic client/server over a minimal channel; transports for DOM MessagePort, Electron
  `MessagePortMain`/`parentPort`, and in-memory (tests). Servers validate all inputs; clients reconnect and resubscribe
  after host restarts.
- Ports are created in main and handed to host and renderer; preload exposes only port retrieval and platform info.
- **Terminal data path:** PTY output feeds the headless mirror and a per-Terminal buffer flushed every 8 ms or 64 KB;
  the renderer acknowledges written characters; the host pauses the PTY above 100k unacknowledged characters and
  resumes below 5k.

### 5.3 Modules

| Module | Runs in | Responsibility |
|--------|---------|----------------|
| `git` | workspace-host | Worktrees, status, changed files per Diff mode, blobs, stage/unstage ranges, Integrate, Conflict state. Porcelain v2 / `-z` parsing only; per-Worktree write mutex; `--no-optional-locks`; long-lived `cat-file --batch` |
| `sessions` | workspace-host | Session list merged from `git worktree list` and stored metadata; create / Archive / Discard; Setup script spec |
| `fs`, `watch`, `search` | workspace-host | Versioned read/write (echo suppression), file listing via `git ls-files`, @parcel/watcher per open Session with coalescing and rescan on overflow, ripgrep JSON streaming |
| `pty` | pty-host | Create, attach (snapshot + seq), input, paste, resize, kill tree, shell detection, running-children check; mirror tracks cwd, title and bracketed-paste mode |
| `terminal` | renderer | `TerminalRenderer` interface + xterm implementation; WebGL context budget (≤ 8 per Window, visible first, DOM fallback); controller for ack and re-attach |
| `layout` | shared core + renderer | Pure split-tree operations and serialization; stable Item hosting so moves never remount; preset application |
| `editor` | renderer | Ref-counted Monaco model registry, disk sync + conflict banner, highlighting behind a `Highlighting` interface (`@shikijs/monaco` first), language-features seam |
| `review` | shared core + workspace-host storage + renderer | Pure `applyLineChanges`, Viewed, Local comments, Feedback formatter and sanitizer |
| `github` | github-host + shared mapping | `ReviewProvider` interface (Inbox, Pull request, files, Threads, checks, Pending review mutations) with `GitHubProvider` and `FakeProvider`; auth; focus-aware poller; pure Thread → diff-line mapping |
| `settings` | shared schema; main (global) / workspace-host (repo) | zod schemas exported as JSON Schema; JSONC layered merge; comment-preserving edits; hot reload |
| `persistence` | hosts | Versioned JSON documents with migrations, debounced atomic writes, scrollback store |
| `commands`, `keymap` | renderer | Command registry with context conditions; Zed-format keymap resolution with chords |

**Seam for agents (later):** Terminal launch specs carry `profileId` and `tags`; a future agent profile extends a
Terminal profile, and an agent host would be another utility process.

### 5.4 Source layout

```
electron.vite.config.ts   electron-builder.yml   .npmrc (node-linker=hoisted)
src/shared/{contract,rpc,domain/{layout,review,github-mapping,paths}}
src/main/{index,windows,registry,broker,supervisor,auth,security,menu}
src/hosts/workspace/{index,git,sessions,fs,watch,search,settings,store}
src/hosts/pty/{index,shells,mirror,flow,env}
src/hosts/github/{index,provider,octokit,fake,poller,etag}
src/preload/index.ts
src/renderer/src/{app,commands,keymap,workspace,editor,terminal,review,github,sessions,ui,theme}
tests/{e2e,fixtures/{repo-builder.ts,fake-shell.mjs,github/}}
scripts/{gen-tokens.ts,record-github.ts,load-harness.mjs}
```

Single package (no pnpm workspaces). dependency-cruiser enforces: `shared` imports nothing platform-specific;
the renderer never imports hosts.

## 6. Technical risks and mitigations

| Risk | Mitigation |
|------|------------|
| node-pty / native module builds per Electron version and arch | Pin versions; `@electron/rebuild` when prebuilds don't match; `asarUnpack` node-pty, @parcel/watcher, ripgrep; release builds on native-arch runners |
| Windows ConPTY quirks | Bundled ConPTY where node-pty supports it; xterm `windowsPty` option; debounce resizes, never resize hidden/0-column Terminals; chunked input writes; `taskkill /T /F` for trees; strip `ELECTRON_*` from child env |
| GUI apps on macOS lack shell `PATH` | Resolve login-shell environment at startup |
| WebGL context limit with many Terminals | Context budget (≤ 8 per Window), LRU release, DOM renderer fallback on context loss |
| Monaco + TextMate highlighting performance and bundling | `@shikijs/monaco` with lazy grammars behind `Highlighting`; M1 perf gate (typing p95 < 16 ms on 10k-line TS) with vscode-textmate as fallback; only required Monaco workers bundled |
| Memory with many editors/diffs | Shared models by URI with ref-counting; dispose hidden editors after saving view state; size guards |
| Worktree edge cases | Pre-check branch checkout; handle locked/prunable/missing; submodules shown as "submodule changed" with optional `submodule update` setup step; LFS pointers; renames (`-M`); case-insensitive paths; Windows removal retries |
| Agents running git concurrently | `--no-optional-locks` on reads; per-Worktree write mutex; watcher on git-dir files to refresh |
| Hunk staging correctness (CRLF, filters) | Blob rewrite approach ([ADR-0008](./adr/0008-hunk-staging-via-blob-rewrite.md)); fuzz tests against a `git apply` oracle; preserve dominant EOL, warn on mixed |
| Thread position mapping | Diff from local refs matching GitHub's merge-base diff; RIGHT lines on head, LEFT on merge-base; ranges; file-level Threads in file header; Outdated panel; comments limited to lines in hunks |
| Untrusted Pull request text pasted into Terminals | Strip ESC and C0 controls (except tab/newline), bracketed paste only when enabled, never send Enter |
| File watching at scale | One watcher per open Session honoring `.gitignore` + `node_modules`; coalescing; rescan on overflow; Worktrees outside the Repo |
| GitHub rate limits | ETags (304 served from cache), focus-aware polling, GraphQL polling only for visible Pull requests, backoff on limit headers |
| Unsigned builds | Ad-hoc sign macOS (required on arm64); document Gatekeeper `xattr` workaround and SmartScreen prompt; prefer `gh` token over stored credentials because keychain approval resets per unsigned build |

## 7. Milestones and acceptance criteria

Order is fixed (D29): the local review loop is dogfoodable before GitHub work starts.

### M0 — Foundation

- Scaffold (electron-vite, TS strict, ESLint, dependency-cruiser), CI on Windows + macOS.
- `DESIGN.md` App section and token generator (CSS variables + TS module).
- Security baseline (§5.1; Electron fuses deferred to M6), rpc library with three transports, broker, supervisor.
- Registry: welcome Window, open folder → new Window, same Repo → focus, non-git → `git init` flow, linked Worktree → Repo Window.
- Command palette, keymap resolver, `keymap.json` hot reload.

**Accept:** two Repos open in two Windows and reopening one focuses it; no CSP violations and no Node globals in the
renderer; a keymap override applies without restart.
**Tests:** Vitest — rpc (errors, cancellation, streams, schema rejection, reconnect), keymap (contexts, chords,
platforms), token snapshot. Playwright — launch with temp `IREVIEW_HOME`, open fixture Repo, `git init` flow, palette.

### M1 — Workspace

- Layout core, Panes, Docks, tabs, drag to split; virtualized file tree; Monaco with token theme and highlighting;
  model registry; quick open; streaming search; EOL/BOM-preserving save; concurrent-edit banner; Layout persistence.

**Accept:** quick open < 100 ms on 50k files; external edit reloads a clean buffer within 1 s and shows the banner on a
dirty one; moving an Item keeps undo and cursor; highlighting perf gate passes.
**Tests:** Vitest — property tests for Layout operations, serialization round-trip, fuzzy scorer, watcher coalescer,
EOL/BOM round-trip. Playwright — split/move/close, quick open, external-edit banner, search.

### M2 — Terminals

- pty-host (mirror, flow control, env, tree kill), shell detection, `TerminalRenderer` + xterm implementation with
  WebGL budget, search and `file:line` links, Terminal profiles and Layout presets (JSON + UI), reserved chords,
  attach/detach.

**Accept:** 10 Terminals each flooding 5 MB/s keep input echo p95 < 50 ms; 20 Terminals never render blank; renderer
reload re-attaches all Terminals intact; killing a Terminal kills its children; manual checklist with `claude` and
`codex` on both OSes (resize, `Ctrl+C`, 5k-character paste intact).
**Tests:** Vitest — flow-control state machine, batcher, paste sanitizer, shell detection with fake fs, profile merge.
Playwright with `fake-shell` — echo round-trip, Dock split, reload re-attach.

### Ghostty spike (after M2, ≤ 1 week, alongside early M3, non-blocking)

- `experimental.terminalRenderer` flag with ghostty-web and restty implementations; load harness with 10 busy Terminals
  on Windows and macOS measuring throughput, input latency, memory, IME/wide characters, agent TUIs; outcome recorded
  as an ADR.

### M3 — Sessions

- Session service (create with Base ref picker, copy globs, trusted Setup script in visible Terminal; Archive; Discard),
  Main checkout Session, "use Main checkout" opt-in, Session switcher (palette + Dock), per-Session Layouts,
  missing/prunable/external Worktrees.

**Accept:** a Session from `origin/main` lands at the short path and runs setup visibly; switching keeps Terminals
running; Discard succeeds on Windows with a live Terminal; branch-already-checked-out gives an actionable error.
**Tests:** Vitest integration on real temp repos on both OSes — Worktree lifecycle, prunable, dirty removal, slugs,
submodule fixture, `core.autocrlf=true` fixture. Playwright — New Session flow.

### M4 — Local review

- Changed-file list per Diff mode (renames, binary, untracked, submodule), diff view with navigation, Viewed,
  revert / stage / unstage hunk, Local comments, Feedback (overflow file, delete once sent), commit / push / pull /
  fetch, Integrate with conflict prediction and Main checkout checks, minimal Conflict handling.

**Accept:** staging a middle hunk makes `git diff --cached` equal exactly that hunk (including a CRLF repo on Windows);
a comment on line 40 moves to 45 after inserting 5 lines above it in-app; sending Feedback produces one sanitized paste
with no Enter; a conflicting Integrate lists files, Continue completes and Abort restores.
**Tests:** Vitest — `applyLineChanges` fuzzed against `git apply`, porcelain parsers, Feedback formatter snapshots,
comment tracking, Conflict-state fixtures. Playwright — full review loop with `fake-shell` recording stdin.

### M5 — GitHub

- Auth (`gh` token, device flow), provider (+ Fake), remote selection, Inbox, Pull request view (local-ref diff, inline
  Threads, Outdated panel, checks), Pending review writes (comments, multi-line, suggestions, reply, resolve, submit,
  discard), PR session (fork read-only), Threads → Feedback, focus-aware poller.

**Accept (Fake provider):** Threads land on correct LEFT/RIGHT lines; mutations fire in the right order on submit;
poll cadence follows focus. Manual checklist against a sandbox repository on GitHub.
**Tests:** Vitest — Thread mapping fixtures (multi-line, LEFT, outdated, file-level, renamed), ETag layer and GraphQL
operations via recorded MSW fixtures, poller with fake timers; one provider contract suite run against Fake (CI) and
real GitHub (opt-in).

### M6 — Restore and release

- Full restore (§3.9) with mode reset after history replay, 30 s scrollback snapshots, state migrations, quit
  confirmation (foreground process detection on macOS, process tree on Windows), Electron fuses (§5.1),
  electron-builder artifacts (macOS arm64 + x64 dmg/zip, Windows x64 NSIS), tag-triggered release workflow, packaged
  smoke test.

**Accept:** relaunch restores Layout and Terminals (history, then a fresh prompt in the right cwd); after a hard kill
the restore is at most 30 s stale; quitting with a running process prompts; all three artifacts launch on clean
machines.
**Tests:** Vitest — migrations, atomic writer, replay mode reset. Playwright — relaunch cycle with shared
`IREVIEW_HOME`; packaged-app smoke test in the release workflow.

## 8. Verification strategy

- **Run:** `pnpm dev` (renderer hot reload; hosts restart and the renderer re-attaches); `pnpm build && pnpm preview`
  for the production bundle.
- **Test switches:** `IREVIEW_HOME` (isolated state), `--test-hooks` (exposes Terminal buffer text and store
  snapshots to Playwright), `--fake-github` (FakeProvider).
- **Fixtures:** `repo-builder.ts` builds temp repos with isolated git config (`GIT_CONFIG_GLOBAL`, `GIT_CONFIG_NOSYSTEM`),
  fixed author and dates; `fake-shell.mjs` provides prompt, echo, stdin recording and flood mode; GitHub REST/GraphQL
  responses recorded via `record-github.ts` into scrubbed MSW fixtures.
- **CI:** lint + typecheck on Ubuntu; unit, git integration and Playwright e2e on `windows-latest` and `macos-latest`
  (Windows includes autocrlf fixtures); nightly non-gating load harness uploading metrics; tag-triggered release on
  native-arch runners with packaged smoke test.

## 9. Later (post-v1)

- Agent profiles with prompt templates; agent status (Claude Code hooks, Codex notify, OSC notifications); ACP sessions.
- Create and merge Pull requests; other providers (GitLab, Bitbucket, Azure DevOps).
- LSP-backed navigation and diagnostics.
- Stacked multi-file diff view.
- JetBrains-style merge tool (three panes, per-chunk accept).
- Signed builds, notarization, auto-update; official Linux builds.
- Light theme; multi-repo Windows; repos inside WSL.
- Ghostty-based Terminal renderer, depending on the spike.
