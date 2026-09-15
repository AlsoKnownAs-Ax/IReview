import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { resolveAppUrl } from './app-url'

const root = join('/', 'app', 'out', 'renderer')

describe('resolveAppUrl', () => {
  test('serves a file inside the renderer bundle', () => {
    expect(resolveAppUrl('app://ireview/assets/index.js', root)).toBe(join(root, 'assets', 'index.js'))
  })

  test('serves index.html for the root', () => {
    expect(resolveAppUrl('app://ireview/', root)).toBe(join(root, 'index.html'))
  })

  test('rejects hosts other than the app host', () => {
    expect(resolveAppUrl('app://other/index.html', root)).toBeNull()
  })

  test('rejects schemes other than app:', () => {
    expect(resolveAppUrl('file://ireview/index.html', root)).toBeNull()
  })

  test.each([
    ['dot segments', 'app://ireview/../main/index.js'],
    ['encoded dot segments', 'app://ireview/%2e%2e/main/index.js'],
  ])('clamps %s to the bundle root', (_, url) => {
    expect(resolveAppUrl(url, root)).toBe(join(root, 'main', 'index.js'))
  })

  test.each([
    ['encoded slashes', 'app://ireview/..%2f..%2fmain%2findex.js'],
    ['encoded backslashes', 'app://ireview/..%5c..%5cmain%5cindex.js'],
    ['Windows separators', 'app://ireview/assets\\..\\..\\main\\index.js'],
    ['encoded drive letters', 'app://ireview/C:%5cWindows%5cwin.ini'],
    ['encoded NUL bytes', 'app://ireview/index.html%00.js'],
    ['malformed encodings', 'app://ireview/%E0%A4%A'],
  ])('rejects paths escaping the bundle via %s', (_, url) => {
    expect(resolveAppUrl(url, root)).toBeNull()
  })

  test('rejects URLs that do not parse', () => {
    expect(resolveAppUrl('not a url', root)).toBeNull()
  })
})
