import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'

export interface LaunchedApp {
  app: ElectronApplication
  window: Page
  close(): Promise<void>
}

/** Launches the built app with an isolated `IREVIEW_HOME` (SPEC §8). */
export async function launchApp(): Promise<LaunchedApp> {
  const home = await mkdtemp(join(tmpdir(), 'ireview-home-'))
  const app = await electron.launch({
    args: ['out/main/index.js'],
    env: { ...process.env, IREVIEW_HOME: home },
  })

  return {
    app,
    window: await app.firstWindow(),
    async close() {
      await app.close()
      await rm(home, { recursive: true, force: true })
    },
  }
}
