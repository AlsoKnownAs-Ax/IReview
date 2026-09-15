import { expect, test } from '@playwright/test'
import { launchApp, type LaunchedApp } from '../fixtures/launch-app'

let launched: LaunchedApp

test.beforeEach(async () => {
  launched = await launchApp()
  await expect(launched.window.locator('h1')).toHaveText('IReview')
})

test.afterEach(async () => {
  await launched.close()
})

test('every app:// response carries a strict CSP and the renderer loads without violations', async () => {
  const { window } = launched
  // Record violations from before the first page script runs, then load the page again.
  await window.addInitScript(`
    window.cspViolations = []
    document.addEventListener('securitypolicyviolation', (event) => window.cspViolations.push(event.violatedDirective))
  `)
  await window.reload()
  // The welcome Window is fully rendered, so its styles count towards the violations below.
  await expect(window.getByRole('button', { name: 'Open Folder' })).toBeVisible()

  const policies = await window.evaluate(async () => {
    const policy = async (path: string) => (await fetch(path)).headers.get('content-security-policy')
    return [await policy('/index.html'), await policy('/missing.js')]
  })
  for (const policy of policies) {
    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'")
    expect(policy).toContain("connect-src 'self'")
  }
  expect(await window.evaluate('window.cspViolations')).toEqual([])
})

test('inline scripts and remote connections are blocked', async () => {
  const { window } = launched
  // Tests compile without DOM types, so in-page code is passed as a string.
  await window.evaluate(`
    window.cspViolations = []
    document.addEventListener('securitypolicyviolation', (event) => window.cspViolations.push(event.effectiveDirective))
    const script = document.createElement('script')
    script.textContent = 'window.inlineRan = true'
    document.body.append(script)
  `)

  const fetched = await window.evaluate(() =>
    fetch('https://example.com/', { mode: 'no-cors' }).then(
      () => 'resolved',
      () => 'rejected',
    ),
  )

  expect(fetched).toBe('rejected')
  await expect
    .poll(async () => ((await window.evaluate('window.cspViolations')) as string[]).toSorted())
    .toEqual(['connect-src', 'script-src-elem'])
  expect(await window.evaluate('window.inlineRan')).toBeUndefined()
})

test('the renderer has no Node globals', async () => {
  const types = await launched.window.evaluate(
    '({ require: typeof require, process: typeof process, module: typeof module, Buffer: typeof Buffer })',
  )
  expect(types).toEqual({ require: 'undefined', process: 'undefined', module: 'undefined', Buffer: 'undefined' })
})
