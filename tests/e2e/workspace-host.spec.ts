import { expect, test, type Page } from '@playwright/test'
import { launchApp, type LaunchedApp } from '@tests/fixtures/launch-app'

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

async function expectHostConnected(window: Page): Promise<void> {
  await expect(window.getByTestId('workspace-host-status')).toHaveText('Workspace host connected')
}

test('the Window shows that its workspace host answered a ping, again after a reload', async () => {
  await expectHostConnected(launched.window)

  await launched.window.reload()

  await expectHostConnected(launched.window)
})

test('closing the Window stops its workspace host', async () => {
  const { app, window } = launched
  await expectHostConnected(window)
  const metrics = await app.evaluate(({ app }) => app.getAppMetrics())
  const hostMetric = metrics.find((metric) => metric.name === 'IReview Workspace Host')
  if (!hostMetric) throw new Error('The Window has no workspace host process')
  expect(isRunning(hostMetric.pid)).toBe(true)

  // A second, hostless window keeps the app from quitting, so only closing the Window can stop the host.
  await app.evaluate(({ BrowserWindow }) => {
    const [target] = BrowserWindow.getAllWindows()
    new BrowserWindow({ show: false })
    target?.close()
  })

  await expect.poll(() => isRunning(hostMetric.pid)).toBe(false)
})
