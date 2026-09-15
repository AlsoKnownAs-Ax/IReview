import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'

test('loads the renderer from app:// and serves nothing outside the bundle', async () => {
  const home = await mkdtemp(join(tmpdir(), 'ireview-home-'))
  const app = await electron.launch({
    args: ['out/main/index.js'],
    env: { ...process.env, IREVIEW_HOME: home },
  })

  try {
    const window = await app.firstWindow()
    await expect(window.locator('h1')).toHaveText('IReview')
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
    await app.close()
    await rm(home, { recursive: true, force: true })
  }
})
