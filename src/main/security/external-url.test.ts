import { describe, expect, test } from 'vitest'
import { isAllowedExternalUrl } from './external-url'

describe('isAllowedExternalUrl', () => {
  test('allows https URLs', () => {
    expect(isAllowedExternalUrl('https://github.com/AlsoKnownAs-Ax/IReview/pull/1')).toBe(true)
  })

  test.each([
    ['http', 'http://github.com/'],
    ['file', 'file:///C:/Windows/System32/calc.exe'],
    ['javascript', 'javascript:alert(1)'],
    ['data', 'data:text/html,<script>alert(1)</script>'],
    ['app', 'app://ireview/index.html'],
    ['custom scheme', 'vscode://file/etc/passwd'],
    ['credentials', 'https://user:secret@github.com/'],
    ['username only', 'https://user@github.com/'],
    ['malformed', 'https://'],
    ['empty', ''],
  ])('rejects %s URLs', (_, url) => {
    expect(isAllowedExternalUrl(url)).toBe(false)
  })
})
