import { expect, test } from '@playwright/test'
import { launchApp } from '../fixtures/launch-app'

test('launches a window titled IReview', async () => {
  const { window, close } = await launchApp()

  try {
    await expect(window).toHaveTitle('IReview')
    await expect(window.locator('h1')).toHaveText('IReview')
    // Tailwind resolves `bg-canvas` to the DESIGN.md `canvas` token (#010102).
    await expect(window.locator('main')).toHaveCSS('background-color', 'rgb(1, 1, 2)')
  } finally {
    await close()
  }
})
