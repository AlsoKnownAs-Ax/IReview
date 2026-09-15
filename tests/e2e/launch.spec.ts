import { expect, test } from '@playwright/test'
import { launchApp } from '../fixtures/launch-app'

test('launches a window titled IReview', async () => {
  const { window, close } = await launchApp()

  try {
    await expect(window).toHaveTitle('IReview')
    await expect(window.locator('h1')).toHaveText('IReview')
  } finally {
    await close()
  }
})
