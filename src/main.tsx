import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import DualPreview from './DualPreview.tsx'

/** 对照预览（带手机外框）只给宽屏电脑看；真机直接进 App */
function shouldShowDualPreview(): boolean {
  const params = new URLSearchParams(window.location.search)
  const demo = params.get('demo') === '1'
  const embed = params.get('embed')
  if (!demo || embed) return false
  // 真机 / 窄屏：不要套手机模型
  if (window.matchMedia('(max-width: 900px)').matches) return false
  if (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1100) {
    return false
  }
  return true
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {shouldShowDualPreview() ? <DualPreview /> : <App />}
  </StrictMode>,
)
