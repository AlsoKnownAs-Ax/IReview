import { parse } from 'yaml'

/** What `pnpm gen:tokens` reads and the generated, committed theme it writes, relative to the repo root. */
export const TOKEN_PATHS = {
  design: 'DESIGN.md',
  css: 'src/renderer/src/theme/tokens.css',
  ts: 'src/renderer/src/theme/tokens.ts',
} as const

const HEADER = '/* Generated from DESIGN.md by scripts/gen-tokens.ts. Do not edit; run `pnpm gen:tokens`. */'

interface TextStyle {
  fontFamily: string
  fontSize: string
  fontWeight: number
  lineHeight: number
  letterSpacing: string | number
}

/** The DESIGN.md front-matter groups that become tokens. `components` only references these, so it is left out. */
interface Tokens {
  colors: Record<string, string>
  typography: Record<string, TextStyle>
  rounded: Record<string, string>
  spacing: Record<string, string>
}

const GROUPS = ['colors', 'typography', 'rounded', 'spacing'] as const

/** Turns the DESIGN.md front matter into a Tailwind v4 `@theme` stylesheet and a TS module of the same tokens. */
export function generateTokens(designMd: string): { css: string; ts: string } {
  const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(designMd)?.[1]
  if (frontMatter === undefined) throw new Error('DESIGN.md has no front matter')
  const groups: Partial<Tokens> = parse(frontMatter)
  const missing = GROUPS.find((group) => !groups[group])
  if (missing) throw new Error(`DESIGN.md front matter has no ${missing}`)
  const { colors, typography, rounded, spacing } = groups as Tokens
  const tokens: Tokens = { colors, typography, rounded, spacing }

  return {
    css: `${HEADER}\n@theme {\n${themeVariables(tokens)
      .map((variable) => `  ${variable};\n`)
      .join('')}}\n`,
    ts: `${HEADER}\nexport const tokens = ${JSON.stringify(tokens, null, 2)} as const\n`,
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
  const scale = (namespace: string, values: Record<string, string>) =>
    Object.entries(values).map(([name, value]) => `--${namespace}-${name}: ${value}`)

  return [
    '--color-*: initial',
    ...scale('color', colors),
    '--text-*: initial',
    ...Object.entries(typography).flatMap(([name, style]) => [
      `--text-${name}: ${style.fontSize}`,
      `--text-${name}--line-height: ${style.lineHeight}`,
      `--text-${name}--font-weight: ${style.fontWeight}`,
      `--text-${name}--letter-spacing: ${style.letterSpacing}`,
    ]),
    '--radius-*: initial',
    ...scale('radius', rounded),
    ...scale('spacing', spacing),
  ]
}
