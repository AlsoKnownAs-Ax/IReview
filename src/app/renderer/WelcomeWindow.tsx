import { useId, type ReactElement } from 'react'

/** The Window shown on launch, before a Repo is opened (SPEC §3.1). */
export function WelcomeWindow(): ReactElement {
  const recentReposHeadingId = useId()

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col gap-lg px-md py-xxl">
      <header className="flex items-center justify-between gap-md">
        <h1 className="text-card-title">IReview</h1>
        {/* Opening a folder is wired up in #28. */}
        <button
          type="button"
          className="rounded-md bg-primary px-sm py-xs text-button text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-focus/50 active:bg-primary-focus"
        >
          Open Folder
        </button>
      </header>
      <section aria-labelledby={recentReposHeadingId} className="rounded-lg border border-hairline bg-surface-1">
        <h2 id={recentReposHeadingId} className="border-b border-hairline px-sm py-xs text-eyebrow text-ink-muted">
          Recent Repos
        </h2>
        <p className="px-sm py-lg text-center text-body-sm text-ink-subtle">No recent Repos</p>
      </section>
    </div>
  )
}
