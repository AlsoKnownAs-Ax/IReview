import { expect, test } from '@playwright/test'
import { launchApp, type LaunchedApp } from '../fixtures/launch-app'

let launched: LaunchedApp

test.beforeEach(async () => {
  launched = await launchApp()
  await expect(launched.window.locator('h1')).toHaveText('IReview')
})

test.afterEach(async () => {
  await launched.close()
})

test('navigation away from the app is refused', async () => {
  const { window } = launched
  const url = window.url()

  await window.evaluate('window.stillHere = true; location.href = "https://example.com/"')
  await window.waitForTimeout(500)

  expect(window.url()).toBe(url)
  expect(await window.evaluate('window.stillHere')).toBe(true)
})

test('window.open creates no window and hands only https URLs to the OS browser', async () => {
  const { app, window } = launched
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
  expect(await launched.window.evaluate('Notification.requestPermission()')).toBe('denied')
})
