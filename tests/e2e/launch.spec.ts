import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'

test('launches a window titled IReview', async () => {
  const home = await mkdtemp(join(tmpdir(), 'ireview-home-'))
  const app = await electron.launch({
    args: ['out/main/index.js'],
    env: { ...process.env, IREVIEW_HOME: home },
  })

  try {
    const window = await app.firstWindow()
    await expect(window).toHaveTitle('IReview')
    await expect(window.locator('h1')).toHaveText('IReview')
  } finally {
    await app.close()
    await rm(home, { recursive: true, force: true })
  }
})
