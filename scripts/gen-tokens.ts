import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { generateTokens, TOKEN_FILES } from './tokens.ts'

const generated = generateTokens(readFileSync('DESIGN.md', 'utf8'))
for (const kind of ['css', 'ts'] as const) {
  mkdirSync(dirname(TOKEN_FILES[kind]), { recursive: true })
  writeFileSync(TOKEN_FILES[kind], generated[kind])
}
