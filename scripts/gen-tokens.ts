import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { generateTokens, TOKEN_PATHS } from './tokens.ts'

const generated = generateTokens(readFileSync(TOKEN_PATHS.design, 'utf8'))
for (const kind of ['css', 'ts'] as const) {
  mkdirSync(dirname(TOKEN_PATHS[kind]), { recursive: true })
  writeFileSync(TOKEN_PATHS[kind], generated[kind])
}
