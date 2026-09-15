import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

let home: string
let app: ElectronApplication
let window: Page

test.beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'ireview-home-'))
  app = await electron.launch({
    args: ['out/main/index.js'],
    env: { ...process.env, IREVIEW_HOME: home },
  })
  window = await app.firstWindow()
  await expect(window.locator('h1')).toHaveText('IReview')
})

test.afterEach(async () => {
  await app.close()
  await rm(home, { recursive: true, force: true })
})

test('navigation away from the app is refused', async () => {
  const url = window.url()
  await window.evaluate('window.stillHere = true; location.href = "https://example.com/"')
  await window.waitForTimeout(500)

  expect(window.url()).toBe(url)
  expect(await window.evaluate('window.stillHere')).toBe(true)
})

test('window.open creates no window and hands only https URLs to the OS browser', async () => {
  await app.evaluate(({ shell }) => {
    const opened: string[] = []
    Object.assign(globalThis, { opened })
    shell.openExternal = async (url) => {
      opened.push(url)
    }
  })

  await window.evaluate(
    'window.open("https://example.com/"); window.open("http://example.com/"); window.open("file:///etc/hosts")',
  )
  await window.waitForTimeout(500)

  expect(app.windows()).toHaveLength(1)
  expect(await app.evaluate(() => (globalThis as unknown as { opened: string[] }).opened)).toEqual([
    'https://example.com/',
  ])
})

test('permission requests are denied', async () => {
  expect(await window.evaluate('Notification.requestPermission()')).toBe('denied')
})
