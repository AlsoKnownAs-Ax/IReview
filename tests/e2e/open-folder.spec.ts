import { mkdir, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { launchApp, type LaunchedApp } from '@tests/fixtures/launch-app'
import { buildRepo, type TempRepo } from '@tests/fixtures/repo-builder'

let launched: LaunchedApp
let repo: TempRepo
let ceilingBefore: string | undefined

test.beforeEach(async () => {
  // Keeps git from finding a repo above the temp dir, such as a dotfiles repo in the home folder.
  ceilingBefore = process.env['GIT_CEILING_DIRECTORIES']
  process.env['GIT_CEILING_DIRECTORIES'] = tmpdir()
  launched = await launchApp()
  repo = await buildRepo()
  await expect(launched.window.getByRole('button', { name: 'Open Folder' })).toBeVisible()
})

test.afterEach(async () => {
  process.env['GIT_CEILING_DIRECTORIES'] = ceilingBefore
  await launched.close()
  await repo.cleanup()
})

/** Open Folder from the Welcome Window with the native picker stubbed to answer `path`. */
async function openFolder(path: string) {
  await launched.app.evaluate(({ dialog }, picked) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [picked] })
  }, path)
  await launched.window.getByRole('button', { name: 'Open Folder' }).click()
}

async function openRepoWindow(path: string): Promise<Page> {
  const opened = launched.app.waitForEvent('window')
  await openFolder(path)
  return opened
}

async function windowId(page: Page): Promise<number> {
  const window = await launched.app.browserWindow(page)
  return window.evaluate(({ id }) => id)
}

/** Replaces `focus` on every Window with a recorder, since a headless run cannot be trusted to report real focus. */
async function recordFocus(): Promise<() => Promise<number[]>> {
  await launched.app.evaluate(({ BrowserWindow }) => {
    const focused: number[] = []
    Object.assign(globalThis, { focused })
    BrowserWindow.getAllWindows().forEach((window) => {
      window.focus = () => {
        focused.push(window.id)
      }
    })
  })
  return () => launched.app.evaluate(() => (globalThis as unknown as { focused: number[] }).focused)
}

test('opens one Repo Window per Repo, each showing its checkout root', async () => {
  const other = await buildRepo()

  try {
    const first = await openRepoWindow(repo.mainCheckout)
    const second = await openRepoWindow(other.mainCheckout)

    await expect(first.getByTestId('repo-checkout-root')).toHaveText(await realpath(repo.mainCheckout))
    await expect(second.getByTestId('repo-checkout-root')).toHaveText(await realpath(other.mainCheckout))
    expect(launched.app.windows()).toHaveLength(3)
  } finally {
    await other.cleanup()
  }
})

test('focuses the open Window when its Repo, or a linked Worktree of it, is opened again', async () => {
  const worktree = await repo.addWorktree('feature')
  const id = await windowId(await openRepoWindow(repo.mainCheckout))
  const focused = await recordFocus()

  await openFolder(repo.mainCheckout)
  await expect.poll(focused).toEqual([id])
  await openFolder(worktree)
  await expect.poll(focused).toEqual([id, id])

  expect(launched.app.windows()).toHaveLength(2)
})

test('opens a new Window for a Repo whose Window was closed', async () => {
  const id = await windowId(await openRepoWindow(repo.mainCheckout))
  await launched.app.evaluate(({ BrowserWindow }, closing) => BrowserWindow.fromId(closing)?.close(), id)
  await expect.poll(() => launched.app.windows().length).toBe(1)

  const reopened = await openRepoWindow(repo.mainCheckout)

  await expect(reopened.getByTestId('repo-checkout-root')).toHaveText(await realpath(repo.mainCheckout))
  expect(await windowId(reopened)).not.toBe(id)
})

test('explains a folder that is not a Repo and opens nothing', async () => {
  const plain = join(repo.dir, 'plain')
  await mkdir(plain)

  await openFolder(plain)

  await expect(launched.window.getByRole('alert')).toHaveText(`${plain} is not a git repository.`)
  expect(launched.app.windows()).toHaveLength(1)
})
