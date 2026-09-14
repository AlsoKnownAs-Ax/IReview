# Agents are plain CLIs in terminals; no agent model in v1

In v1 the app has no concept of an agent. Developers open Terminals and run Claude Code, Codex or any other CLI themselves. The app detects no agent status and sends no notifications. Feedback is pasted into whichever Terminal the reviewer picks. This keeps the app agent-agnostic, means CLI updates can't break it, and keeps v1 focused on review. The cost: the app can't tell which Terminal holds an agent or whether that agent is waiting for input.

## Considered Options

- **Structured integration (ACP or vendor SDKs)**: rich tool-call and edit events, and permission prompts inside the app. Rejected for v1 because every agent needs its own adapter and far more UI.
- **Agent profiles with status adapters** (Claude Code hooks, Codex `notify`): deferred, not rejected. Terminal launch specs carry a profile id and tags so agent profiles, and later ACP, can be added without reworking Terminals.
