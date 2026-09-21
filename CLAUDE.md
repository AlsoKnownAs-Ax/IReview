## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (AlsoKnownAs-Ax/IReview) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` plus `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Modules

Modules are carved by domain and entered only through a front door — an `index.ts` per process subfolder. Nothing imports below a front door, values or types. See `docs/agents/modules.md` and `docs/adr/0010-domain-modules-behind-front-doors.md`.

### UI

When building UI use the `DESIGN.md` file at the repo root.
