import { session } from 'electron'

type Directives = Record<string, readonly string[]>

const CSP_HEADER = 'Content-Security-Policy'

const BASE_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'wasm-unsafe-eval'"],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'frame-ancestors': ["'none'"],
} satisfies Directives

const CONTENT_SECURITY_POLICY = serialize(BASE_DIRECTIVES)

/** Returns `response` carrying the app's CSP (SPEC §5.1). */
export function withContentSecurityPolicy(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set(CSP_HEADER, CONTENT_SECURITY_POLICY)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

/**
 * Applies the policy to the Vite dev server, relaxed only as far as HMR needs: its inline React Refresh preamble,
 * injected `<style>` tags and its websocket. Must run after the app is ready.
 */
export function enforceCspOnDevServer(devServerUrl: string) {
  const { origin, host } = new URL(devServerUrl)
  const policy = serialize({
    ...BASE_DIRECTIVES,
    'script-src': [...BASE_DIRECTIVES['script-src'], "'unsafe-inline'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'connect-src': [...BASE_DIRECTIVES['connect-src'], `ws://${host}`],
  })

  session.defaultSession.webRequest.onHeadersReceived({ urls: [`${origin}/*`] }, (details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, [CSP_HEADER]: [policy] } })
  })
}

function serialize(directives: Directives): string {
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ')
}
