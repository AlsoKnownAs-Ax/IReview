import type { ReactElement } from 'react'
import type { ResolvedRepo } from '@/repo/contract'

/** A Window bound to one Repo for its whole life (SPEC §3.1). Shows the Repo until Sessions arrive with M3. */
export function RepoWindow({ repo }: { repo: ResolvedRepo }): ReactElement {
  return (
    <div className="flex flex-col gap-xs px-md py-lg">
      <p className="text-eyebrow text-ink-muted">Repo</p>
      <p data-testid="repo-checkout-root" className="font-mono text-mono text-ink">
        {repo.checkoutRoot}
      </p>
    </div>
  )
}
