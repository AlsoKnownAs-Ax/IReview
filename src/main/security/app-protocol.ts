import { pathToFileURL } from 'node:url'
import { net, protocol } from 'electron'
import { APP_SCHEME } from '../config'
import { resolveAppUrl } from './app-url'
import { CONTENT_SECURITY_POLICY } from './csp'

/** Must run before the app is ready. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } },
  ])
}

/** Serves the renderer bundle in `root` over `app://` under the app's CSP. Anything else is a 404. */
export function serveRendererOverAppProtocol(root: string): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const file = resolveAppUrl(request.url, root)
    if (!file) return notFound()

    let response: Response
    try {
      response = await net.fetch(pathToFileURL(file).toString())
    } catch {
      return notFound()
    }
    const headers = new Headers(response.headers)
    headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY)
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  })
}

function notFound(): Response {
  return new Response('Not found', { status: 404 })
}
