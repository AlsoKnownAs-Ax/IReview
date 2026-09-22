// The four rules of ADR-0010, split where one rule needs two checks. Every rule has a unique name, so a violation
// report says which one fired.

/** Electron, the process subfolders, and `src/git`, the host-only leaf: nothing platform-free may reach these. */
const PROCESS_SPECIFIC = '^(electron$|node_modules/electron/|src/git/|src/[^/]+/(main|preload|host|renderer)/)'

/** `contract/` and `core/` run in any process, and `src/shared` is a leaf that runs everywhere. */
const PLATFORM_FREE = '^src/(shared/|[^/]+/(contract|core)/)'

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
      name: 'no-import-below-a-front-door',
      severity: 'error',
      comment:
        'A module subfolder is entered through its index.ts (ADR-0010). Everything beside it is implementation, and ' +
        'the rule covers types as much as values. src/shared is a leaf, so its files are importable by name.',
      // $1 is the importing module, which reaches its own implementation freely: only other modules are shut out.
      // The `to` path has no trailing slash, so `src/git`'s own files are behind its front door too.
      from: { path: '^src/([^/]+)/' },
      to: { path: '^src/[^/]+/[^/]+', pathNot: ['^src/$1/', '^src/shared/', '/index\\.tsx?$'] },
    },
    {
      name: 'renderer-not-host-main-or-preload',
      severity: 'error',
      comment:
        'The renderer is the least-trusted peer: it coordinates hosts over rpc, never by importing them, and git is ' +
        'host-only.',
      from: { path: '^src/[^/]+/renderer/' },
      to: { path: PROCESS_SPECIFIC, pathNot: '^src/[^/]+/renderer/' },
    },
    {
      name: 'renderer-no-node-builtins',
      severity: 'error',
      comment: 'The sandboxed renderer has no Node built-ins to import.',
      from: { path: '^src/[^/]+/renderer/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'platform-free-not-process-specific',
      severity: 'error',
      comment: 'contract/, core/ and src/shared run in any process, so they import neither Electron nor process code.',
      from: { path: PLATFORM_FREE },
      to: { path: PROCESS_SPECIFIC },
    },
    {
      name: 'platform-free-no-node-builtins',
      severity: 'error',
      comment: 'contract/, core/ and src/shared run in any process, including the sandboxed renderer.',
      from: { path: PLATFORM_FREE },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'fixtures-only-in-tests',
      severity: 'error',
      comment: 'Test fixtures never ship: only test files import them.',
      from: { path: '^src/', pathNot: '\\.test\\.tsx?$' },
      to: { path: '^tests/' },
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
    // Every tsconfig extends tsconfig.paths.json, so any of them resolves the @ aliases.
    tsConfig: { fileName: 'tsconfig.node.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'],
    },
  },
}
