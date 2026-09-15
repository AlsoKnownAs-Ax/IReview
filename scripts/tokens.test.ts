import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { generateTokens, TOKEN_PATHS } from './tokens.ts'

const DESIGN = `---
name: Fixture
colors:
  canvas: "#010102"
  diff-added-bg: "#27a6441f"
typography:
  body-sm:
    fontFamily: Linear Text
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.40
    letterSpacing: -0.2px
rounded:
  md: 8px
spacing:
  xs: 8px
components:
  button:
    backgroundColor: "{colors.canvas}"
---

# Prose is ignored
`
const HEADER = '/* Generated from DESIGN.md by scripts/gen-tokens.ts. Do not edit; run `pnpm gen:tokens`. */'

describe('generateTokens', () => {
  test('maps each token group to its Tailwind theme namespace', () => {
    expect(generateTokens(DESIGN).data?.css).toBe(`${HEADER}
@theme {
  --color-*: initial;
  --color-canvas: #010102;
  --color-diff-added-bg: #27a6441f;
  --text-*: initial;
  --text-body-sm: 13px;
  --text-body-sm--line-height: 1.4;
  --text-body-sm--font-weight: 500;
  --text-body-sm--letter-spacing: -0.2px;
  --radius-*: initial;
  --radius-md: 8px;
  --spacing-xs: 8px;
}
`)
  })

  test('exports the same tokens from a typed TS module', () => {
    expect(generateTokens(DESIGN).data?.ts).toBe(`${HEADER}
export const tokens = {
  "colors": {
    "canvas": "#010102",
    "diff-added-bg": "#27a6441f"
  },
  "typography": {
    "body-sm": {
      "fontFamily": "Linear Text",
      "fontSize": "13px",
      "fontWeight": 500,
      "lineHeight": 1.4,
      "letterSpacing": "-0.2px"
    }
  },
  "rounded": {
    "md": "8px"
  },
  "spacing": {
    "xs": "8px"
  }
} as const
`)
  })

  test.each([
    ['no front matter', '# No tokens', { code: 'MISSING_FRONT_MATTER' }],
    ['an unclosed front matter', DESIGN.replace('\n---\n', '\n----\n'), { code: 'MISSING_FRONT_MATTER' }],
    ['malformed YAML', '---\ncolors: [\n---', { code: 'INVALID_YAML' }],
    [
      'a missing token group',
      DESIGN.replace('rounded:', 'corners:'),
      { code: 'INVALID_TOKENS', issues: [{ path: ['rounded'] }] },
    ],
  ])('reports a document with %s', (_, designMd, error) => {
    expect(generateTokens(designMd)).toMatchObject({ data: null, error })
  })

  test('the committed theme files match a fresh generation from DESIGN.md', () => {
    const committed = { css: readFileSync(TOKEN_PATHS.css, 'utf8'), ts: readFileSync(TOKEN_PATHS.ts, 'utf8') }
    expect(generateTokens(readFileSync(TOKEN_PATHS.design, 'utf8')), 'stale tokens: run `pnpm gen:tokens`').toEqual({
      data: committed,
      error: null,
    })
  })
})
