import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import DualPreview from './DualPreview.tsx'
import { loadSession, type AuthSession } from './lib/auth'
import { loadDemo } from './lib/storage'

export type ViewMode = 'mobile' | 'pc' | 'mobilepc'

function isPhoneViewport(): boolean {
  if (window.matchMedia('(max-width: 900px)').matches) return true
  if (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1100) {
    return true
  }
  return false
}

/** URL 区分布局；未指定时：真机手机、电脑左右对照 */
function readViewMode(): ViewMode {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view')
  if (view === 'pc' || view === 'mobilepc' || view === 'mobile') return view
  return isPhoneViewport() ? 'mobile' : 'mobilepc'
}

function Root() {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession())
  const view = readViewMode()
  const demo = loadDemo() || new URLSearchParams(window.location.search).get('demo') === '1'

  // 成员账号：单页手机端（除非 URL 强制 pc / mobilepc）
  if (session?.role === 'member' && view !== 'pc' && view !== 'mobilepc') {
    return <App layout="mobile" onSessionChange={setSession} />
  }

  if (view === 'mobile') {
    return <App layout="mobile" onSessionChange={setSession} />
  }

  if (view === 'pc') {
    return <App layout="pc" onSessionChange={setSession} />
  }

  // mobilepc / 电脑默认：先登录（非演示），管理员进左右对照
  if (!session && !demo) {
    return <App layout="pc" onSessionChange={setSession} />
  }

  if (session?.role === 'member') {
    return <App layout="pc" onSessionChange={setSession} />
  }

  return <DualPreview onSessionChange={setSession} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
