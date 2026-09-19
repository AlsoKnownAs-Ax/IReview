/**
 * Names the port main brokers into each renderer page, both as the IPC channel to preload and as the `window` message
 * preload forwards (SPEC §5.2). Kept free of zod so the sandboxed preload stays small.
 */
export const WORKSPACE_HOST_PORT = 'workspace-host-port'
