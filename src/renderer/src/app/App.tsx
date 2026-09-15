import type { ReactElement } from 'react'
import { WelcomeWindow } from './WelcomeWindow'

export function App(): ReactElement {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <WelcomeWindow />
    </main>
  )
}
