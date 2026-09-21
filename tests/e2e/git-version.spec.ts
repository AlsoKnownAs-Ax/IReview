import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { launchApp, type LaunchedApp } from '@tests/fixtures/launch-app'

let launched: LaunchedApp

test.beforeEach(async () => {
  launched = await launchApp()
})

test.afterEach(async () => {
  await launched.close()
})

test('the Window shows the version of the system git', async () => {
  const status = launched.window.getByTestId('git-version-status')

  await expect(status).toHaveText(/^git \d+\.\d+\.\d+$/)

  const shownVersion = (await status.textContent())?.replace('git ', '')
  expect(execFileSync('git', ['--version'], { encoding: 'utf8' })).toContain(`git version ${shownVersion}`)
})
