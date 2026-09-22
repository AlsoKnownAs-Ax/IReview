import { app, shell, type Session, type WebContents } from 'electron'
import { isAllowedExternalUrl } from './external-url'

/**
 * No navigation away from the loaded page, no new windows, no webviews and no permissions, for every webContents and
 * session the app creates. Must run before the app is ready.
 */
export function lockDownWebContents(): void {
  app.on('web-contents-created', (_, contents) => lockDown(contents))
  app.on('session-created', denyPermissions)
}

function lockDown(contents: WebContents): void {
  // Covers the main frame and subframes, but not what the main process loads with loadURL. Reloading the current
  // document (such as Vite's full reload in dev) is not navigating away, so it is allowed.
  contents.on('will-frame-navigate', (event) => {
    if (event.url !== event.frame?.url) {
      event.preventDefault()
    }
  })
  contents.on('will-redirect', (event) => event.preventDefault())
  contents.on('will-attach-webview', (event) => event.preventDefault())

  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url)
    }

    return { action: 'deny' }
  })
}

function denyPermissions(session: Session): void {
  session.setPermissionRequestHandler((_, __, callback) => callback(false))
  session.setPermissionCheckHandler(() => false)
}
