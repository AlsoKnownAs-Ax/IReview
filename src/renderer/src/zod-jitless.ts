import { z } from 'zod'

// Zod probes for `new Function` to compile faster parsers. The renderer's CSP forbids eval, so that probe is reported as
// a violation even though zod catches it (SPEC §5.1). Schemas read this when they are created, so import this first.
z.config({ jitless: true })
