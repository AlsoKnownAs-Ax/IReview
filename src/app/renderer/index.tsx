import './zod-jitless'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { connectWorkspaceHost } from '@/repo/renderer'
import { App } from './App'
import './theme/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

const workspaceHost = connectWorkspaceHost()

createRoot(root).render(
  <StrictMode>
    <App workspaceHost={workspaceHost} />
  </StrictMode>,
)
