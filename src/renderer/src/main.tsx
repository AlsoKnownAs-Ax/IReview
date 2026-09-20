import './app/zod-jitless'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { connectWorkspaceHost } from './workspace/workspace-host'
import './theme/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

const workspaceHost = connectWorkspaceHost()

createRoot(root).render(
  <StrictMode>
    <App workspaceHost={workspaceHost} />
  </StrictMode>,
)
