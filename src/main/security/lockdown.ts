import { app, shell, type WebContents } from 'electron'
import { isAllowedExternalUrl } from './external-url'

/**
 * Applies to every webContents the app creates: no navigation, no new windows, no webviews, no permissions.
 * Must run before the first window is created.
 */
export function lockDownWebContents(): void {
  app.on('web-contents-created', (_, contents) => lockDown(contents))
}

function lockDown(contents: WebContents): void {
  // Covers the main frame and subframes; navigations main starts with loadURL don't emit it.
  contents.on('will-frame-navigate', (event) => event.preventDefault())
  contents.on('will-attach-webview', (event) => event.preventDefault())

  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  contents.session.setPermissionRequestHandler((_, __, callback) => callback(false))
  contents.session.setPermissionCheckHandler(() => false)
}
