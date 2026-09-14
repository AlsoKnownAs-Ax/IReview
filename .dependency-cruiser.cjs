/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies make modules hard to reason about and test.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'shared-is-platform-free',
      severity: 'error',
      comment: 'src/shared runs everywhere, so it imports no Node built-ins (SPEC §5.4).',
      from: { path: '^src/shared' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'shared-is-platform-free',
      severity: 'error',
      comment: 'src/shared runs everywhere, so it imports neither Electron nor process-specific code (SPEC §5.4).',
      from: { path: '^src/shared' },
      to: { path: '^(electron$|node_modules/electron/|src/(main|preload|renderer|hosts)/)' },
    },
    {
      name: 'renderer-not-hosts-or-main',
      severity: 'error',
      comment: 'The sandboxed renderer imports no Node built-ins (SPEC §5.1).',
      from: { path: '^src/renderer' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'renderer-not-hosts-or-main',
      severity: 'error',
      comment: 'The renderer never imports Electron, main, preload or hosts (SPEC §5.4).',
      from: { path: '^src/renderer' },
      to: { path: '^(electron$|node_modules/electron/|src/(main|preload|hosts)/)' },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment: 'Every import must resolve.',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'],
    },
  },
}
