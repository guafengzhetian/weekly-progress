import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import DualPreview from './DualPreview.tsx'

export type ViewMode = 'mobile' | 'pc' | 'mobilepc'

/** URL 区分布局：默认 mobile；pc；mobilepc=左右对照 */
function readViewMode(): ViewMode {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view')
  if (view === 'pc' || view === 'mobilepc' || view === 'mobile') return view
  return 'mobile'
}

const view = readViewMode()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {view === 'mobilepc' ? (
      <DualPreview />
    ) : (
      <App layout={view === 'pc' ? 'pc' : 'mobile'} />
    )}
  </StrictMode>,
)
