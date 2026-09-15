import { session } from 'electron'

type Directives = Record<string, string[]>

const PRODUCTION: Directives = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'wasm-unsafe-eval'"],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'frame-ancestors': ["'none'"],
}

/** The policy every `app://` response carries (SPEC §5.1). */
export const CONTENT_SECURITY_POLICY = serialize(PRODUCTION)

/**
 * Applies the policy to the Vite dev server, relaxed only as far as HMR needs: its inline React Refresh preamble,
 * injected `<style>` tags and its websocket. Must run after the app is ready.
 */
export function enforceCspOnDevServer(devServerUrl: string): void {
  const { origin, host } = new URL(devServerUrl)
  const policy = serialize({
    ...PRODUCTION,
    'script-src': [...(PRODUCTION['script-src'] ?? []), "'unsafe-inline'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'connect-src': ["'self'", `ws://${host}`],
  })

  session.defaultSession.webRequest.onHeadersReceived({ urls: [`${origin}/*`] }, (details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [policy] } })
  })
}

function serialize(directives: Directives): string {
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ')
}
