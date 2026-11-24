import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { resetLegacySaves } from './features/survival/legacySaveReset'

const root = document.getElementById('root')
if (!root) throw new Error('Missing application root')

const resetError = resetLegacySaves()
createRoot(root).render(resetError
  ? <div role="alert">{resetError}</div>
  : <StrictMode><App/></StrictMode>)
