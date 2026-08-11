import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import DualPreview from './DualPreview.tsx'

function shouldShowDualPreview(): boolean {
  const params = new URLSearchParams(window.location.search)
  const demo = params.get('demo') === '1'
  const embed = params.get('embed')
  return demo && !embed
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {shouldShowDualPreview() ? <DualPreview /> : <App />}
  </StrictMode>,
)
