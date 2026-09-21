import { join, sep } from 'node:path'
import { APP_HOST, APP_SCHEME } from '@/app/main/config'

// Separators other than `/`, drive-letter colons and NUL.
const FORBIDDEN_PATH_CHARS = /[\\:\0]/

/**
 * Maps an `app://` request URL to a file inside `root`, or `null` when the URL must not be served.
 * The URL parser already collapses dot segments, so they can never climb above the root; this also rejects anything
 * that only becomes a traversal after percent-decoding.
 */
export function resolveAppUrl(url: string, root: string): string | null {
  const parsed = URL.parse(url)
  if (!parsed || parsed.protocol !== `${APP_SCHEME}:` || parsed.host !== APP_HOST) return null

  const pathname = decodePath(parsed.pathname)
  if (pathname === null || FORBIDDEN_PATH_CHARS.test(pathname)) return null

  const segments = (pathname === '/' ? '/index.html' : pathname).split('/').filter(Boolean)
  if (segments.some((segment) => segment === '.' || segment === '..')) return null

  const file = join(root, ...segments)
  return file.startsWith(join(root) + sep) ? file : null
}

/** `decodeURIComponent` that returns `null` for malformed percent-encoding instead of throwing. */
function decodePath(path: string): string | null {
  try {
    return decodeURIComponent(path)
  } catch {
    return null
  }
}
