import { expect, test } from '@playwright/test'
import { launchApp } from '../fixtures/launch-app'

test('launch shows the welcome Window with Open Folder and no Recent Repos yet', async () => {
  const { window, close } = await launchApp()

  try {
    await expect(window.getByRole('heading', { level: 1, name: 'IReview' })).toBeVisible()
    await expect(window.getByRole('button', { name: 'Open Folder' })).toBeVisible()
    const recentRepos = window.getByRole('region', { name: 'Recent Repos' })
    await expect(recentRepos).toBeVisible()
    await expect(recentRepos.getByText('No recent Repos')).toBeVisible()
  } finally {
    await close()
  }
})
