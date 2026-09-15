import { expect, test } from '@playwright/test'
import { launchApp, type LaunchedApp } from '../fixtures/launch-app'

let launched: LaunchedApp

test.beforeEach(async () => {
  launched = await launchApp()
})

test.afterEach(async () => {
  await launched.close()
})

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

test('the Window shows that its workspace host answered a ping, again after a reload', async () => {
  const { window } = launched
  await expect(window.getByTestId('workspace-host-status')).toHaveText('Workspace host connected')

  await window.reload()

  await expect(window.getByTestId('workspace-host-status')).toHaveText('Workspace host connected')
})

test('closing the Window stops its workspace host', async () => {
  const { app, window } = launched
  await expect(window.getByTestId('workspace-host-status')).toHaveText('Workspace host connected')
  const metrics = await app.evaluate(({ app }) => app.getAppMetrics())
  const host = metrics.find((metric) => metric.name === 'IReview Workspace Host')
  if (!host) throw new Error('The Window has no workspace host process')
  expect(isRunning(host.pid)).toBe(true)

  // A second, hostless window keeps the app from quitting, so only closing the Window can stop the host.
  await app.evaluate(({ BrowserWindow }) => {
    const [target] = BrowserWindow.getAllWindows()
    new BrowserWindow({ show: false })
    target?.close()
  })

  await expect.poll(() => isRunning(host.pid)).toBe(false)
})
