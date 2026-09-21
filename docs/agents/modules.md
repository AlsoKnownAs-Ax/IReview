# Modules and the front-door rule

How this codebase is carved up, and the one import rule that keeps it that way.
The decision and its reasoning are in [ADR-0010](../adr/0010-domain-modules-behind-front-doors.md).

## The front-door rule

**A module is entered through its front door.** Nothing imports below a front door — not values, not types.

A front door is an `index.ts`. Everything beside it is implementation, and no other module may know it exists.

```ts
import { resolveRepo } from '@/repo/host' // yes
import { resolveRepo } from '@/repo/host/resolve-repo' // no: reaches past the front door
```

The rule covers types as much as values. Types are how implementation details leak quietest: reading another
module's error fields is the same coupling as calling one of its private functions.

## Modules are domains, not layers

A module owns a concept from [`CONTEXT.md`](../../CONTEXT.md), top to bottom — its wire schemas, its pure logic,
its Node side and its UI. Two concepts too small to stand alone are one module.

| Module           | Owns                                                                       |
| ---------------- | -------------------------------------------------------------------------- |
| `repo`           | Repo identity, Window binding, the Repo → Window registry, git preconditions |
| `session`        | Worktree lifecycle, Base ref, Setup script, Integrate, Archive, Discard, PR session, and the files inside a Worktree (tree, watch, search, read/write) |
| `buffer`         | Buffers, Monaco, highlighting, disk sync, the concurrent-edit banner         |
| `layout`         | The split tree, Panes, Docks, Items, Layout presets                          |
| `terminal`       | PTYs, mirrors, flow control, `TerminalRenderer`, Terminal profiles           |
| `review`         | Diff mode, Viewed, Local comments, Feedback, Conflict                        |
| `pull-request`   | Inbox, Pull request view, Threads, Pending review, the PR session loop       |
| `app`            | Window chrome, commands, keymap, settings merge, security, `app://`, process entry points |
| `git`            | The system git CLI. Infrastructure, not a domain — see below.                |

There is no `persistence` module: versioned JSON, migrations and atomic writes belong to whichever domain owns
the state being written.

## Subfolders name the process

Electron gives us four runtimes that cannot import each other freely, so a module's subfolders say where code runs.
A module creates only the ones it needs.

| Subfolder    | Runs in                 | Holds                                                            |
| ------------ | ----------------------- | ---------------------------------------------------------------- |
| `contract/`  | nowhere — types only    | this module's oRPC contract slice: zod schemas and error maps      |
| `core/`      | any process             | pure domain logic, no I/O                                          |
| `main/`      | the main process        | window binding, registry, broker, dialogs                          |
| `host/`      | a utility process       | git, fs, watcher, node-pty, Octokit                                |
| `renderer/`  | a Window, sandboxed     | React components and Zustand stores                                |
| `preload/`   | a preload script        | `app` only                                                         |

Each subfolder has its own front door. **There is no module-root `index.ts`**: a single barrel would re-export
host code into the renderer's import graph, which is what [ADR-0006](../adr/0006-per-window-utility-hosts.md)
exists to prevent. `src/app/host/` is the one subfolder without a front door: a utility process is started by
path rather than imported, so it holds one entry point per host (`workspace.ts`, later `pty.ts`).

```
review/
├── contract/index.ts   the seam that crosses processes
├── core/index.ts       pure logic, any process
├── host/index.ts       the Node adapter
└── renderer/index.ts   the UI adapter
```

## Who may import what

| Import                                  | Allowed from            |
| --------------------------------------- | ----------------------- |
| `@/<module>/contract`, `@/<module>/core` | anywhere, any process   |
| `@/<module>/host`                        | host-side code only     |
| `@/<module>/renderer`                    | renderer code only      |
| `@/<module>/main`, `@/<module>/preload`  | main-side code only     |
| `@/shared/*`, `@/git`                    | leaves; see below       |
| anything below a front door              | nobody                  |

Modules may import each other directly, in any direction, as long as the graph stays acyclic. Between *processes*
the stricter rule from ADR-0006 still holds: hosts never call each other, and the renderer coordinates.

`.dependency-cruiser.cjs` enforces all of this in CI.

## Leaves

Two things are imported by everyone and own no domain:

- **`src/shared/`** — `rpc` (`serve`/`connect`), `result`, and one `contract/<host>.ts` per utility process that
  composes the contract slices its domains export. Alongside them sit the few wire shapes no domain owns, such as
  `contract/ports.ts` and `contract/git.ts`, whose schemas describe the git CLI that `repo`, `session` and `review`
  all shell out to. Platform-free: no Node built-ins, no Electron.
- **`src/git/`** — the system git CLI behind one interface: invocation policy (`--no-optional-locks`, `LC_ALL=C`),
  porcelain parsing, the per-Worktree write mutex, long-lived `cat-file --batch`
  ([ADR-0005](../adr/0005-git-cli-in-utility-process.md)). Host-only, so it has no process seam and no subfolders.

git is a leaf because it is a mechanism, not a concept. `repo`, `session` and `review` all need it; none of them
owns it, and making one of them own it would turn that module into a pass-through for the others.

## Adding a module

1. Check `CONTEXT.md` for the term. If the concept isn't in the glossary, either you're inventing language the
   project doesn't use, or there's a real gap — resolve it there first, and don't reuse a word the glossary marks
   as avoided.
2. Create only the subfolders you need, each with an `index.ts`.
3. If it crosses a process seam, put its zod schemas in `contract/` and add the slice to the right
   `src/shared/contract/<host>.ts`.
4. Keep the front door small. A module that exports everything it contains is a folder, not a module.
