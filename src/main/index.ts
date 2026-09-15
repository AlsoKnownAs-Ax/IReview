import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { serveRendererOverAppProtocol, registerAppScheme } from './security/app-protocol'
import { APP_ORIGIN } from './security/app-url'

registerAppScheme()

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

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devServerUrl) {
    void window.loadURL(devServerUrl)
  } else {
    void window.loadURL(`${APP_ORIGIN}/index.html`)
  }
}

void app.whenReady().then(() => {
  serveRendererOverAppProtocol(join(__dirname, '../renderer'))
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
