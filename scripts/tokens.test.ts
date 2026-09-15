import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { generateTokens, TOKEN_FILES } from './tokens.ts'

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
    expect(generateTokens(DESIGN).css).toBe(`${HEADER}
@theme {
  --color-*: initial;
  --color-canvas: #010102;
  --color-diff-added-bg: #27a6441f;
  --text-body-sm: 13px;
  --text-body-sm--line-height: 1.4;
  --text-body-sm--font-weight: 500;
  --text-body-sm--letter-spacing: -0.2px;
  --radius-md: 8px;
  --spacing-xs: 8px;
}
`)
  })

  test('exports the same tokens from a typed TS module', () => {
    expect(generateTokens(DESIGN).ts).toBe(`${HEADER}
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

  test('rejects a document without front matter', () => {
    expect(() => generateTokens('# No tokens')).toThrow('DESIGN.md has no front matter')
  })

  test('the committed theme files match a fresh generation from DESIGN.md', () => {
    const fresh = generateTokens(readFileSync('DESIGN.md', 'utf8'))
    const stale = 'is stale: run `pnpm gen:tokens`'
    expect(readFileSync(TOKEN_FILES.css, 'utf8'), `${TOKEN_FILES.css} ${stale}`).toBe(fresh.css)
    expect(readFileSync(TOKEN_FILES.ts, 'utf8'), `${TOKEN_FILES.ts} ${stale}`).toBe(fresh.ts)
  })
})
