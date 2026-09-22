import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { generateTokens, TOKEN_PATHS, type GeneratedTokens } from './tokens.ts'

const { data: generated, error } = generateTokens(readFileSync(TOKEN_PATHS.design, 'utf8'))
if (error) {
  throw new Error(`Cannot generate tokens from ${TOKEN_PATHS.design}: ${JSON.stringify(error, null, 2)}`)
}

const OUTPUTS = ['css', 'ts'] as const satisfies readonly (keyof GeneratedTokens)[]
OUTPUTS.forEach((kind) => {
  mkdirSync(dirname(TOKEN_PATHS[kind]), { recursive: true })
  writeFileSync(TOKEN_PATHS[kind], generated[kind])
})
