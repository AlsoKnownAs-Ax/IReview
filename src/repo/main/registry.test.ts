import { describe, expect, test, vi, type Mock } from 'vitest'
import type { ResolvedRepo } from '@/repo/contract'
import { createRepoRegistry, type RepoWindow } from './registry'

type FakeWindow = RepoWindow & { focus: Mock<() => void>; close(): void }

const repo: ResolvedRepo = { identity: '/repo/.git', checkoutRoot: '/repo' }
const worktree: ResolvedRepo = { identity: '/repo/.git', checkoutRoot: '/worktrees/feature' }
const other: ResolvedRepo = { identity: '/other/.git', checkoutRoot: '/other' }

function fakeWindow(): FakeWindow {
  const listeners: (() => void)[] = []
  return {
    focus: vi.fn(),
    on: (_event, listener) => {
      listeners.push(listener)
    },
    close: () => listeners.forEach((listener) => listener()),
  }
}

function setUp() {
  const created: FakeWindow[] = []
  const createWindow = vi.fn((): FakeWindow => {
    const window = fakeWindow()
    created.push(window)
    return window
  })
  return { created, createWindow, registry: createRepoRegistry({ createWindow }) }
}

describe('open', () => {
  test('creates one Window per Repo', () => {
    const { createWindow, registry } = setUp()

    registry.open(repo)
    registry.open(other)

    expect(createWindow.mock.calls).toEqual([[repo], [other]])
  })

  test('focuses the Window of a Repo that is already open, also from a linked Worktree', () => {
    const { created, createWindow, registry } = setUp()
    registry.open(repo)

    registry.open(repo)
    registry.open(worktree)

    expect(createWindow).toHaveBeenCalledTimes(1)
    expect(created[0]?.focus).toHaveBeenCalledTimes(2)
  })

  test('creates a new Window for a Repo whose Window was closed', () => {
    const { created, createWindow, registry } = setUp()
    registry.open(repo)
    created[0]?.close()

    registry.open(repo)

    expect(createWindow).toHaveBeenCalledTimes(2)
    expect(created[0]?.focus).not.toHaveBeenCalled()
  })
})
