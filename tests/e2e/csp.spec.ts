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

test('the renderer loads with a strict CSP and no violations', async () => {
  const { window } = launched
  // Record violations from before the first page script runs, then load the page again.
  await window.addInitScript(`
    window.cspViolations = []
    document.addEventListener('securitypolicyviolation', (event) => window.cspViolations.push(event.violatedDirective))
  `)
  await window.reload()
  await expect(window.locator('h1')).toHaveText('IReview')

  const policy = await window.evaluate(async () => (await fetch('/index.html')).headers.get('content-security-policy'))
  expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'")
  expect(policy).toContain("connect-src 'self'")
  expect(await window.evaluate('window.cspViolations')).toEqual([])
})

test('inline scripts and remote connections are blocked', async () => {
  const result = await launched.window.evaluate(`(async () => {
    const violations = []
    document.addEventListener('securitypolicyviolation', (event) => violations.push(event.effectiveDirective))

    const script = document.createElement('script')
    script.textContent = 'window.inlineRan = true'
    document.body.append(script)

    const fetched = await fetch('https://example.com/', { mode: 'no-cors' }).then(() => 'resolved', () => 'rejected')
    await new Promise((resolve) => setTimeout(resolve, 100))

    return { inlineRan: window.inlineRan === true, fetched, violations }
  })()`)

  expect(result).toEqual({
    inlineRan: false,
    fetched: 'rejected',
    violations: ['script-src-elem', 'connect-src'],
  })
})

test('the renderer has no Node globals', async () => {
  const types = await launched.window.evaluate(
    '({ require: typeof require, process: typeof process, module: typeof module, Buffer: typeof Buffer })',
  )
  expect(types).toEqual({ require: 'undefined', process: 'undefined', module: 'undefined', Buffer: 'undefined' })
})
