# Electron over Tauri, GPUI or a Zed fork

IReview is built on Electron with TypeScript and React, using Monaco for editing and diffs, xterm.js for terminals and node-pty for PTYs. The app lives or dies on its diff editor, many busy terminals and Windows ConPTY support, and this is the exact component set VS Code ships on both OSes. Electron also runs one Chromium engine on Windows and macOS, so rendering, keyboard handling and IME only need testing once.

## Considered Options

- **Tauri 2**: much smaller installer and host memory. Rejected because it uses two different webviews (WebView2 and WKWebView), which doubles testing and brings WebKit keyboard quirks that hurt a terminal-heavy app. Every terminal byte would also cross a Rust → webview bridge that needs tuning. The memory saving is less than it looks: each agent CLI the user runs costs hundreds of MB on its own.
- **Native GPUI (Zed's framework)**: Zed-level performance. Rejected because the framework is young and churns, and the editor, diff view, IME and selection would all have to be built from scratch. Months slower to a first version.
- **Forking Zed**: most features already exist. Rejected because Zed is GPL-3.0 (IReview is MIT), the codebase is large with constant upstream rebases, and its design is editor-first rather than review-first.

## Consequences

Native modules (node-pty, the file watcher, ripgrep) must be rebuilt for each Electron upgrade, unpacked from the asar archive and built per architecture.
