# IReview

A desktop app where a developer reviews and edits code while running coding agents in terminal panes beside it,
so the whole write → review → feedback loop happens in one place.

## Language

### Repositories and sessions

**Repo**:
The git repository a Window is opened on. A Window shows exactly one Repo.
_Avoid_: Project, folder, workspace

**Window**:
One app window, bound to one Repo for its whole life.
_Avoid_: Instance, workspace

**App**:
The window chrome and app-wide wiring every Window shares — commands, keymap, settings, security and process
startup — owned by no single domain.
_Avoid_: Shell, platform, core

**Session**:
A unit of parallel work inside a Repo: one Worktree on one branch, compared against a Base ref, with its own Terminals and Layout.
_Avoid_: Task, workspace, agent session, tab

**Main checkout**:
The Repo's original working directory, always present as a permanent Session.
_Avoid_: Root worktree, primary session

**Worktree**:
The isolated checkout directory that belongs to a single Session.
_Avoid_: Clone, copy, sandbox

**Base ref**:
The branch or commit a Session was started from and is reviewed and integrated against.
_Avoid_: Parent, target, upstream

**PR session**:
A Session whose branch is a Pull request's head, created to run, edit or hand a Pull request to an agent locally.
_Avoid_: PR checkout, review session

**Setup script**:
The per-Repo steps that prepare a freshly created Worktree (copying ignored files, installing dependencies).
_Avoid_: Bootstrap, init hook

**Integrate**:
To bring a Session's commits into its Base ref by merge, squash or rebase.
_Avoid_: Land, ship, finish

**Archive**:
To remove a Session's Worktree while keeping its branch.
_Avoid_: Close, hide

**Discard**:
To remove a Session's Worktree and delete its branch.
_Avoid_: Delete session, abandon

### Layout

**Layout**:
The arrangement of Panes and Docks for a Session.
_Avoid_: Workspace, view

**Pane**:
One region of a Layout that holds a stack of tabbed Items.
_Avoid_: Split, frame, tile

**Item**:
Anything shown as a tab in a Pane: a file, a diff, a Terminal or a Pull request view.
_Avoid_: Editor, tab, document

**Dock**:
A collapsible edge area of the Window (left for files, git and Sessions; bottom or right for Terminals).
_Avoid_: Panel, sidebar, drawer

**Layout preset**:
A named, reusable Layout recipe, such as "agent + dev server + tests".
_Avoid_: Template, profile

### Editing

**Buffer**:
The in-memory content of a file opened for editing, holding its unsaved edits and its own disk-sync state. One
Buffer can be shown by several Items.
_Avoid_: Editor, model, document

### Terminals

**Terminal**:
A shell running inside a Session's Worktree, shown as an Item.
_Avoid_: Console, shell tab, pty

**Terminal profile**:
A named recipe for starting a Terminal: shell, directory, environment and startup command.
_Avoid_: Shell config, launch config

**Agent**:
A coding-agent CLI (for example Claude Code or Codex) that a developer runs inside a Terminal. The app does not track Agents as their own objects.
_Avoid_: Bot, assistant, worker

### Review

**Review**:
Inspecting a set of changes — a Session's or a Pull request's — file by file, and acting on them.
_Avoid_: Diff, inspection

**Diff mode**:
Which changes a Review of a local Session shows: **Since base** (everything since the Base ref, committed or not) or **Uncommitted** (only changes not yet committed).
_Avoid_: Compare mode, scope

**Viewed**:
A reviewer's mark that a changed file has been read; it clears when that file changes again.
_Avoid_: Seen, reviewed, done

**Local comment**:
A reviewer's note on lines of a local change that is never sent to GitHub.
_Avoid_: Annotation, note, draft comment

**Feedback**:
Comments gathered into one prompt and pasted into a chosen Terminal for an Agent to act on.
_Avoid_: Instructions, message, send-back

**Conflict**:
The state where Integrate stopped because the same lines changed on both sides.
_Avoid_: Merge error

### GitHub

**Pull request**:
A GitHub pull request on the Window's Repo.
_Avoid_: PR request, merge request, change request

**Inbox**:
The list of the Repo's Pull requests that involve the user: review requested, authored or participating.
_Avoid_: Dashboard, notifications, queue

**Thread**:
A GitHub review conversation anchored to lines of a Pull request's diff.
_Avoid_: Comment chain, discussion

**Outdated thread**:
A Thread whose lines no longer exist in the Pull request's latest diff.
_Avoid_: Stale comment, orphan

**Pending review**:
The user's unsubmitted set of Thread comments on a Pull request, published together when submitted.
_Avoid_: Draft review, batch
