import { join, sep } from 'node:path'

export const APP_SCHEME = 'app'
export const APP_HOST = 'ireview'
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`

// Characters that must never appear in a decoded path: separators other than `/`, drive-letter colons and NUL.
const FORBIDDEN = /[\\:\0]/

/**
 * Maps an `app://` request URL to a file inside `root`, or `null` when the URL must not be served.
 * The URL parser already collapses dot segments; this also rejects anything that only becomes a traversal after
 * percent-decoding.
 */
export function resolveAppUrl(url: string, root: string): string | null {
  let parsed: URL
  let pathname: string
  try {
    parsed = new URL(url)
    pathname = decodeURIComponent(parsed.pathname)
  } catch {
    return null
  }
  if (parsed.protocol !== `${APP_SCHEME}:` || parsed.host !== APP_HOST) return null
  if (FORBIDDEN.test(pathname)) return null

  const segments = (pathname === '/' ? '/index.html' : pathname).split('/').filter(Boolean)
  if (segments.some((segment) => segment === '.' || segment === '..')) return null

  const file = join(root, ...segments)
  return file.startsWith(join(root) + sep) ? file : null
}
