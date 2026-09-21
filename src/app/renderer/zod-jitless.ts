import { z } from 'zod'

// Zod probes for `new Function` to compile faster parsers. The renderer's CSP forbids eval, so the probe is reported as
// a violation even though zod catches it (SPEC §5.1). Schemas read this setting when they are created, so `main.tsx`
// imports this module first; tests/e2e/csp.spec.ts fails if that order breaks.
z.config({ jitless: true })
