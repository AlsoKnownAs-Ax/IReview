import { expect, test } from '@playwright/test'
import { launchApp } from '../fixtures/launch-app'

test('loads the renderer from app:// and serves nothing outside the bundle', async () => {
  const { window, close } = await launchApp()

  try {
    await expect(window.locator('h1')).toHaveText('IReview')
    expect(await window.evaluate('location.protocol')).toBe('app:')
    expect(window.url()).toBe('app://ireview/index.html')

    const statuses = await window.evaluate(async () => {
      const status = async (path: string) => (await fetch(path)).status
      return {
        index: await status('/index.html'),
        missing: await status('/missing.js'),
        traversal: await status('/..%2fmain%2findex.js'),
      }
    })
    expect(statuses).toEqual({ index: 200, missing: 404, traversal: 404 })
  } finally {
    await close()
  }
})
