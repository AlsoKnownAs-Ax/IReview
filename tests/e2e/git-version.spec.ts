import { expect, test } from '@playwright/test'
import { launchApp, type LaunchedApp } from '@tests/fixtures/launch-app'

let launched: LaunchedApp

test.beforeEach(async () => {
  launched = await launchApp()
})

test.afterEach(async () => {
  await launched.close()
})

// Which version the host reports, and each way it fails, is covered over a MessageChannel in Vitest.
test('the Window shows the version of the system git', async () => {
  await expect(launched.window.getByTestId('git-version-status')).toHaveText(/^git \d+\.\d+\.\d+$/)
})
