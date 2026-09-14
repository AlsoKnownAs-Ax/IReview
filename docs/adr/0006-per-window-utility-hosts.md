# Per-window utility hosts; thin main process

Each Window gets two Electron utility processes: a **workspace host** (git, file system, watcher, search, sessions, repo settings and state) and a **PTY host** (node-pty, headless terminal mirrors, flow control). One **GitHub host**, started when first needed, is shared by the whole app. The main process only brokers MessagePorts, keeps the repo → window registry and supervises the hosts; it never loads native modules.

- **Main stays free of native modules.** If main blocks, every window stalls, and a native crash there kills the whole app.
- **Terminals get their own host.** A watcher storm or a slow git call shouldn't add latency to agent terminals.
- **Hosts are per window.** That matches one repo per window, gives crash isolation and makes cleanup trivial.

## Consequences

- Hosts never call each other; the renderer coordinates them.
- Every contract is validated with zod, because the renderer is the least-trusted peer.
- PTYs outlive renderer reloads and crashes: the renderer re-attaches with a snapshot and a sequence number. The same mechanism serves dev hot reload and restore.
- A few idle Node processes per window is an accepted cost.
