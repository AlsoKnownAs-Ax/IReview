import { expect, test } from '@playwright/test'
import { PORTS } from '@/shared/contract/ports'
import { launchApp } from '@tests/fixtures/launch-app'

// What main answers over its port is covered over a MessageChannel in Vitest; here only the brokering is checked.
test('every page load receives one port under each name main brokers', async () => {
  const { window, close } = await launchApp()

  try {
    await window.addInitScript(`
      window.portsReceived = []
      window.addEventListener('message', ({ data, ports }) => window.portsReceived.push([data, ports.length]))
    `)
    await window.reload()

    await expect
      .poll(async () => ((await window.evaluate('window.portsReceived')) as [string, number][]).toSorted())
      .toEqual(PORTS.map((name): [string, number] => [name, 1]).toSorted())
  } finally {
    await close()
  }
})
