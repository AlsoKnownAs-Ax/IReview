import { pathToFileURL } from 'node:url'
import { net, protocol } from 'electron'
import { APP_SCHEME } from '../config'
import { resolveAppUrl } from './app-url'
import { withContentSecurityPolicy } from './csp'

/** Must run before the app is ready. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } },
  ])
}

/** Serves the renderer bundle in `root` over `app://` under the app's CSP. Anything else is a 404. */
export function serveRendererOverAppProtocol(root: string): void {
  protocol.handle(APP_SCHEME, async (request) => withContentSecurityPolicy(await serve(request.url, root)))
}

async function serve(url: string, root: string): Promise<Response> {
  const file = resolveAppUrl(url, root)
  if (!file) return notFound()
  try {
    return await net.fetch(pathToFileURL(file).toString())
  } catch {
    return notFound()
  }
}

function notFound(): Response {
  return new Response('Not found', { status: 404 })
}
