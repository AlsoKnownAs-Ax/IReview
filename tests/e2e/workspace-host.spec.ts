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

test('the Window shows that its workspace host answered a ping', async () => {
  await expect(launched.window.getByTestId('workspace-host-status')).toHaveText('Workspace host connected')
})

test('the Window reconnects to its workspace host after a reload', async () => {
  const { window } = launched
  await expect(window.getByTestId('workspace-host-status')).toHaveText('Workspace host connected')

  await window.reload()

  await expect(window.getByTestId('workspace-host-status')).toHaveText('Workspace host connected')
})

test('closing the Window stops its workspace host', async () => {
  const { app, window } = launched
  await expect(window.getByTestId('workspace-host-status')).toHaveText('Workspace host connected')
  const hostPids = () =>
    app.evaluate(({ app }) => app.getAppMetrics().flatMap((metric) => (metric.type === 'Utility' ? [metric] : [])))
  const [host] = (await hostPids()).filter((metric) => metric.name === 'IReview Workspace Host')
  expect(host && isRunning(host.pid)).toBe(true)

  // A second, hostless window keeps the app from quitting, so only closing the Window can stop the host.
  await app.evaluate(({ BrowserWindow }) => {
    const [target] = BrowserWindow.getAllWindows()
    new BrowserWindow({ show: false })
    target?.close()
  })

  await expect.poll(() => isRunning(host!.pid)).toBe(false)
})
