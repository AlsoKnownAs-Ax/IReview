import { expect, test } from '@playwright/test'
import { launchApp, type LaunchedApp } from '../fixtures/launch-app'

/** What the main process saw, recorded as it happens so a slow network can't hide a regression. */
interface Probe {
  navigations: { url: string; prevented: boolean }[]
  createdWindows: number
  openedExternally: string[]
}

let launched: LaunchedApp

test.beforeEach(async () => {
  launched = await launchApp()
  await expect(launched.window.locator('h1')).toHaveText('IReview')

  await launched.app.evaluate(({ app, shell, webContents }) => {
    const probe: Probe = { navigations: [], createdWindows: 0, openedExternally: [] }
    Object.assign(globalThis, { probe })
    for (const contents of webContents.getAllWebContents()) {
      contents.on('will-frame-navigate', (event) => {
        probe.navigations.push({ url: event.url, prevented: event.defaultPrevented })
      })
    }
    app.on('browser-window-created', () => probe.createdWindows++)
    shell.openExternal = async (url) => {
      probe.openedExternally.push(url)
    }
  })
})

test.afterEach(async () => {
  await launched.close()
})

function readProbe(): Promise<Probe> {
  return launched.app.evaluate(() => (globalThis as unknown as { probe: Probe }).probe)
}

test('navigation away from the app is refused', async () => {
  const { window } = launched

  await window.evaluate('window.stillHere = true; location.href = "https://example.com/"')

  await expect
    .poll(async () => (await readProbe()).navigations)
    .toEqual([{ url: 'https://example.com/', prevented: true }])
  expect(await window.evaluate('window.stillHere')).toBe(true)
})

test('the renderer can reload itself', async () => {
  const { window } = launched

  await window.evaluate('window.beforeReload = true; location.reload()')

  await expect.poll(() => window.evaluate('window.beforeReload').catch(() => true)).toBeUndefined()
  await expect(window.locator('h1')).toHaveText('IReview')
})

test('window.open creates no window and hands only https URLs to the OS browser', async () => {
  await launched.window.evaluate(
    'window.open("https://example.com/"); window.open("http://example.com/"); window.open("file:///etc/hosts")',
  )
  await expect.poll(async () => (await readProbe()).openedExternally).toEqual(['https://example.com/'])

  expect((await readProbe()).createdWindows).toBe(0)
  expect(launched.app.windows()).toHaveLength(1)
})

test('permission requests are denied', async () => {
  expect(await launched.window.evaluate('Notification.requestPermission()')).toBe('denied')
})
