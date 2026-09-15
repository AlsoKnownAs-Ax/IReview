import { parse } from 'yaml'

/** Where `pnpm gen:tokens` writes the generated, committed theme, relative to the repo root. */
export const TOKEN_FILES = { css: 'src/renderer/src/theme/tokens.css', ts: 'src/renderer/src/theme/tokens.ts' } as const

const HEADER = '/* Generated from DESIGN.md by scripts/gen-tokens.ts. Do not edit; run `pnpm gen:tokens`. */'

interface Typography {
  fontFamily: string
  fontSize: string
  fontWeight: number
  lineHeight: number
  letterSpacing: string | number
}

/** The DESIGN.md front-matter groups that become tokens. `components` only references these, so it is left out. */
interface Tokens {
  colors: Record<string, string>
  typography: Record<string, Typography>
  rounded: Record<string, string>
  spacing: Record<string, string>
}

/** Turns the DESIGN.md front matter into a Tailwind v4 `@theme` stylesheet and a TS module of the same tokens. */
export function generateTokens(designMd: string): { css: string; ts: string } {
  const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(designMd)?.[1]
  if (frontMatter === undefined) throw new Error('DESIGN.md has no front matter')
  const { colors, typography, rounded, spacing }: Tokens = parse(frontMatter)
  const tokens: Tokens = { colors, typography, rounded, spacing }

  return {
    css: `${HEADER}\n@theme {\n${themeVariables(tokens)
      .map((variable) => `  ${variable};\n`)
      .join('')}}\n`,
    ts: `${HEADER}\nexport const tokens = ${JSON.stringify(tokens, null, 2)} as const\n`,
  }
}

/**
 * Maps each group to its Tailwind namespace: `colors` to `--color-*` (replacing Tailwind's palette, so only design
 * colors exist), `typography` to `--text-*` with line-height, weight and tracking, `rounded` to `--radius-*` and
 * `spacing` to `--spacing-*`. Font families stay in the TS module: the Linear faces are not bundled, and Tailwind's
 * system sans and mono stacks match the documented fallbacks.
 */
function themeVariables({ colors, typography, rounded, spacing }: Tokens): string[] {
  return [
    '--color-*: initial',
    ...Object.entries(colors).map(([name, value]) => `--color-${name}: ${value}`),
    ...Object.entries(typography).flatMap(([name, type]) => [
      `--text-${name}: ${type.fontSize}`,
      `--text-${name}--line-height: ${type.lineHeight}`,
      `--text-${name}--font-weight: ${type.fontWeight}`,
      `--text-${name}--letter-spacing: ${type.letterSpacing}`,
    ]),
    ...Object.entries(rounded).map(([name, value]) => `--radius-${name}: ${value}`),
    ...Object.entries(spacing).map(([name, value]) => `--spacing-${name}: ${value}`),
  ]
}
