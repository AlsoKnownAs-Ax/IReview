# xterm.js behind a renderer interface; Ghostty deferred

Terminals render with xterm.js (WebGL, falling back to the DOM renderer) behind a small `TerminalRenderer` interface that excludes xterm-only features. Scrollback restore does not depend on the renderer: a headless xterm mirror in the PTY host serializes it. Ghostty was wanted, but as of September 2026 it wasn't ready:

- `ghostty-web` (the only drop-in web build) is stalled at 0.4.0, draws with Canvas 2D only, lacks serialize and search, and has open input and render bugs.
- `libghostty-vt` is unversioned and draws nothing itself.
- Native Ghostty has no Windows build.

## Consequences

- A feature-flagged spike after milestone M2 load-tests ghostty-web and restty with about 10 busy agent panes on Windows and macOS. Its result is recorded as a follow-up ADR.
- Revisit when libghostty gets a version tag, ghostty-web ships on Ghostty 1.3, or xterm.js adopts libghostty.
- Chromium caps WebGL contexts per renderer process, so terminals share a small context budget. Hidden terminals give theirs up.
