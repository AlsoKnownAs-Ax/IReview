import { parseDocument } from 'yaml'
import { z } from 'zod'

/**
 * What `pnpm gen:tokens` reads and the generated, committed theme it writes. Relative to the working directory, which
 * pnpm and Vitest set to the repo root.
 */
export const TOKEN_PATHS = {
  design: 'DESIGN.md',
  css: 'src/renderer/src/theme/tokens.css',
  ts: 'src/renderer/src/theme/tokens.ts',
} as const

const HEADER = '/* Generated from DESIGN.md by scripts/gen-tokens.ts. Do not edit; run `pnpm gen:tokens`. */'

/** YAML between a leading `---` line and the next `---` line. */
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

const ScaleSchema = z.record(z.string(), z.string())

/**
 * The DESIGN.md front-matter groups that become tokens, in output order. Unknown keys are dropped: `components` only
 * references these groups.
 */
const TokensSchema = z.object({
  colors: ScaleSchema,
  typography: z.record(
    z.string(),
    z.object({
      fontFamily: z.string(),
      fontSize: z.string(),
      fontWeight: z.number(),
      lineHeight: z.number(),
      letterSpacing: z.union([z.string(), z.number()]),
    }),
  ),
  rounded: ScaleSchema,
  spacing: ScaleSchema,
})

type Tokens = z.infer<typeof TokensSchema>

type Result<T, E> = { data: T; error: null } | { data: null; error: E }

export type GeneratedTokens = { css: string; ts: string }

export type TokensError =
  | { code: 'MISSING_FRONT_MATTER' }
  | { code: 'INVALID_YAML'; message: string }
  | { code: 'INVALID_TOKENS'; issues: z.core.$ZodIssue[] }

/** Turns the DESIGN.md front matter into a Tailwind v4 `@theme` stylesheet and a TS module of the same tokens. */
export function generateTokens(designMd: string): Result<GeneratedTokens, TokensError> {
  const frontMatter = FRONT_MATTER.exec(designMd)?.[1]
  if (frontMatter === undefined) return { data: null, error: { code: 'MISSING_FRONT_MATTER' } }

  const document = parseDocument(frontMatter)
  const [yamlError] = document.errors
  if (yamlError) return { data: null, error: { code: 'INVALID_YAML', message: yamlError.message } }

  const { success, data: tokens, error } = TokensSchema.safeParse(document.toJS())
  if (!success) return { data: null, error: { code: 'INVALID_TOKENS', issues: error.issues } }

  const theme = themeVariables(tokens)
    .map((variable) => `  ${variable};\n`)
    .join('')
  return {
    data: {
      css: `${HEADER}\n@theme {\n${theme}}\n`,
      ts: `${HEADER}\nexport const tokens = ${JSON.stringify(tokens, null, 2)} as const\n`,
    },
    error: null,
  }
}

/**
 * Maps each group to its Tailwind namespace, clearing Tailwind's defaults so only design tokens name colors, text
 * styles and radii: `colors` to `--color-*`, `typography` to `--text-*` with line height, weight and tracking,
 * `rounded` to `--radius-*`, `spacing` to `--spacing-*` (Tailwind's numeric spacing stays). Width utilities read
 * `--spacing-*` before container sizes, so `max-w-md` is the `md` spacing token, not 28rem.
 * Font families stay in the TS module only: DESIGN.md substitutes Inter and JetBrains Mono, which are not bundled yet.
 */
function themeVariables({ colors, typography, rounded, spacing }: Tokens): string[] {
  return [
    '--color-*: initial',
    ...scaleVariables('color', colors),
    '--text-*: initial',
    ...Object.entries(typography).flatMap(([name, style]) => [
      `--text-${name}: ${style.fontSize}`,
      `--text-${name}--line-height: ${style.lineHeight}`,
      `--text-${name}--font-weight: ${style.fontWeight}`,
      `--text-${name}--letter-spacing: ${style.letterSpacing}`,
    ]),
    '--radius-*: initial',
    ...scaleVariables('radius', rounded),
    ...scaleVariables('spacing', spacing),
  ]
}

function scaleVariables(namespace: 'color' | 'radius' | 'spacing', scale: Record<string, string>): string[] {
  return Object.entries(scale).map(([name, value]) => `--${namespace}-${name}: ${value}`)
}
