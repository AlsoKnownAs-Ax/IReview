import { dialog, type BrowserWindow } from 'electron'

/**
 * The native folder picker, modal to `window`. `showOpenDialog` is read off `dialog` at call time, so Playwright can
 * stub it from `app.evaluate` without a hook shipped in main.
 */
export async function pickFolder(window: BrowserWindow): Promise<string | null> {
  const {
    canceled,
    filePaths: [path],
  } = await dialog.showOpenDialog(window, { properties: ['openDirectory'] })

  if (canceled || !path) {
    return null
  }

  return path
}
