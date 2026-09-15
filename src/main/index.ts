import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { APP_ORIGIN } from './config'
import { serveRendererOverAppProtocol, registerAppScheme } from './security/app-protocol'
import { enforceCspOnDevServer } from './security/csp'
import { lockDownWebContents } from './security/lockdown'

const devServerUrl = app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL']

registerAppScheme()
lockDownWebContents()

function createWindow(): void {
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

  void window.loadURL(devServerUrl ?? `${APP_ORIGIN}/index.html`)
}

void app.whenReady().then(() => {
  serveRendererOverAppProtocol(join(__dirname, '../renderer'))
  if (devServerUrl) enforceCspOnDevServer(devServerUrl)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
