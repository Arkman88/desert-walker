import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { completeNewGame } from './features/survival/completeNewGame'

const root = document.getElementById('root')
const resetError = completeNewGame()

if (root !== null) {
  createRoot(root).render(resetError
    ? <div role="alert">{resetError}</div>
    : <StrictMode><App/></StrictMode>)
} else {
  throw new Error('Missing application root')
}
