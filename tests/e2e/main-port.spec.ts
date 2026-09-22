import { expect, test } from '@playwright/test'
import { launchApp } from '@tests/fixtures/launch-app'

// What main answers over the port is covered over a MessageChannel in Vitest; here only the brokering is checked.
test('every page load receives one port to main, beside the workspace host port', async () => {
  const { window, close } = await launchApp()

  try {
    await window.addInitScript(`
      window.portsReceived = []
      window.addEventListener('message', ({ data, ports }) => window.portsReceived.push([data, ports.length]))
    `)
    await window.reload()

    await expect
      .poll(async () => ((await window.evaluate('window.portsReceived')) as [string, number][]).toSorted())
      .toEqual([
        ['main-port', 1],
        ['workspace-host-port', 1],
      ])
  } finally {
    await close()
  }
})
