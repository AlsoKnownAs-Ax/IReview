import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import type { ResolvedRepo } from '@/repo/contract'
import { createRepoRegistry } from '@/repo/main'
import { serveMain, startWorkspaceHost } from './broker'
import { APP_ORIGIN } from './config'
import { mainRouter } from './main-router'
import { pickFolder } from './pick-folder'
import { serveRendererOverAppProtocol, registerAppScheme } from './security/app-protocol'
import { enforceCspOnDevServer } from './security/csp'
import { lockDownWebContents } from './security/lockdown'

const devServerUrl = (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) || undefined

registerAppScheme()
lockDownWebContents()

const registry = createRepoRegistry({ createWindow: openWindow })

/** The one way a Window opens: bound to `repo`, or the Welcome Window without one (SPEC §3.1). */
function openWindow(repo?: ResolvedRepo): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })

  startWorkspaceHost(window)
  serveMain(window, mainRouter({ pickFolder: () => pickFolder(window), registry, repo }))
  void window.loadURL(devServerUrl ?? `${APP_ORIGIN}/index.html`)
  return window
}

void app.whenReady().then(() => {
  serveRendererOverAppProtocol(join(__dirname, '../renderer'))
  if (devServerUrl) {
    enforceCspOnDevServer(devServerUrl)
  }

  openWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
