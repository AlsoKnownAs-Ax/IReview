import { dialog, type BrowserWindow } from 'electron'

/** The native folder picker, modal to `window`. Looked up on `dialog` at call time, so a test can stub it. */
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
