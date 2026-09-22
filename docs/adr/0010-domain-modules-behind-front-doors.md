# Domain modules behind front doors

The codebase is carved into modules by **domain**, not by layer or by process. Each module owns one concept from
`CONTEXT.md` top to bottom — its wire schemas, its pure logic, its Node side and its UI — and is entered only
through a front door: an `index.ts` per process subfolder. Nothing imports below a front door, values or types.
Two concepts too small to stand alone are one module. The operational detail lives in
[`docs/agents/modules.md`](../agents/modules.md).

The alternative we had been drifting into was a carve by technology: `git`, `fs`, `watch`, `search`, `settings`,
`persistence`. It reads well in a table and badly in practice — changing how a Session is archived touches four of
those modules and none of them is named after the thing that changed.

- **Domains keep change local.** A concept the glossary names is a concept the product changes as a unit.
- **Front doors make the seam real.** A module whose internals are importable has no interface, only a directory.
  Enforcing the door is what lets the implementation behind it be reorganised without a caller noticing.
- **Types are part of the interface.** Reading another module's error fields is the same coupling as calling its
  private functions, so the rule covers type imports too.
- **Per-process front doors, not one per module.** A module-root barrel would re-export host code into the
  renderer's import graph and undo [ADR-0006](./0006-per-window-utility-hosts.md), which exists because the
  renderer is the least-trusted peer.

## Considered Options

- **Carve by process only** (`main`, `hosts`, `renderer`, `shared`, as the tree was): rejected. It is the coarsest
  possible grouping — every domain is spread across all four, and the only enforced rules are about which process
  may import which.
- **Carve by technology**, as SPEC §5.3 originally tabled: rejected. It names mechanisms rather than concepts, so
  a feature lands across several modules and `persistence` collects state belonging to every domain at once.
- **One module per domain per process** (`review-core`, `review-store`, `review-ui`): rejected. A domain that
  splinters at every process seam is a technical carve wearing domain names, and it triples the module count.
- **Declared interfaces with injected implementations at every module seam**: rejected. Most modules will have
  exactly one implementation forever; an interface with one adapter is a hypothetical seam, and the ceremony buys
  nothing a front door doesn't.

## Consequences

- **A module's interface is its contract, not a barrel.** For modules that cross a process seam, the thing callers
  actually talk through is `<module>/contract/`. `src/shared/contract/<host>.ts` shrinks to a composition of the
  slices each domain exports, so zod stays the single source of truth for schemas, errors and their types
  ([ADR-0009](./0009-orpc-for-host-ipc.md)).
- **Modules may import each other directly**, acyclically, enforced by dependency-cruiser's `no-circular`. Between
  processes the stricter ADR-0006 rule still holds: hosts never call each other; the renderer coordinates.
- **`git` is a leaf, not a domain.** `repo`, `session` and `review` all need the CLI and none owns it. It lives at
  `src/git/`, host-only, and absorbs the invocation policy ADR-0005 requires.
- **`persistence` stops being a module.** Versioned JSON, migrations and atomic writes belong to the domain whose
  state is being written.
- **Naming a module is a domain decision.** The module list is derived from `CONTEXT.md`, so a module cannot be
  named after a word the glossary marks as avoided. This already forced two renames: `editor` → `buffer` (the
  glossary avoids "Editor" as a synonym for **Item**) and `shell` → `app` ("shell" is the OS shell inside a
  **Terminal**).
- **One path alias.** `@/` replaces the five per-process aliases, so a new module costs no config edits.
- **Processes are unchanged.** This is a source-layout and import decision; ADR-0005, ADR-0006 and ADR-0009 all
  still hold as written. SPEC §5.2, §5.3 and §5.4 are updated to match.
