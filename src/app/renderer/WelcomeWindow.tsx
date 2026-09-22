import { useId, useState, type ReactElement } from 'react'
import { openFolderErrorText, type OpenFolderError, type OpenFolderOutcome } from '@/repo/renderer'
import type { Result } from '@/shared/result'

export type WelcomeWindowProps = {
  /** Runs Open Folder; resolves once a Window opened, the picker was cancelled, or with why nothing opened. */
  openFolder: () => Promise<Result<OpenFolderOutcome, OpenFolderError>>
}

type OpenFolderState = { isOpening: boolean; error?: OpenFolderError }

/** The Window shown on launch, before a Repo is opened (SPEC §3.1). */
export function WelcomeWindow({ openFolder }: WelcomeWindowProps): ReactElement {
  const recentReposHeadingId = useId()
  const [opening, setOpening] = useState<OpenFolderState>({ isOpening: false })

  async function onOpenFolder(): Promise<void> {
    setOpening({ isOpening: true })
    const { error } = await openFolder()

    if (error) {
      return setOpening({ isOpening: false, error })
    }

    setOpening({ isOpening: false })
  }

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col gap-lg px-md py-xxl">
      <header className="flex items-center justify-between gap-md">
        <h1 className="text-card-title">IReview</h1>
        <button
          type="button"
          disabled={opening.isOpening}
          onClick={() => void onOpenFolder()}
          className="rounded-md bg-primary px-sm py-xs text-button text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-focus/50 active:bg-primary-focus disabled:opacity-50"
        >
          Open Folder
        </button>
      </header>
      {opening.error ? (
        <p role="alert" className="text-body-sm text-error">
          {openFolderErrorText(opening.error)}
        </p>
      ) : null}
      <section aria-labelledby={recentReposHeadingId} className="rounded-lg border border-hairline bg-surface-1">
        <h2 id={recentReposHeadingId} className="border-b border-hairline px-sm py-xs text-eyebrow text-ink-muted">
          Recent Repos
        </h2>
        <p className="px-sm py-lg text-center text-body-sm text-ink-subtle">No recent Repos</p>
      </section>
    </div>
  )
}
