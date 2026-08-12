import { StrictMode, useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import DualPreview from './DualPreview.tsx'
import { loadSession, type AuthSession } from './lib/auth'
import { loadDemo, loadLayoutView, saveLayoutView } from './lib/storage'

export type ViewMode = 'mobile' | 'pc' | 'mobilepc'
export type MemberView = 'mobile' | 'pc'

function isPhoneViewport(): boolean {
  if (window.matchMedia('(max-width: 900px)').matches) return true
  if (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1100) {
    return true
  }
  return false
}

/** URL 优先；否则用上次选择；再否则按设备 */
function readViewMode(): ViewMode {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view')
  if (view === 'pc' || view === 'mobilepc' || view === 'mobile') return view
  const saved = loadLayoutView()
  if (saved) return saved
  return isPhoneViewport() ? 'mobile' : 'mobilepc'
}

function writeViewParam(view: MemberView | ViewMode) {
  const url = new URL(window.location.href)
  url.searchParams.set('view', view)
  window.history.replaceState({}, '', url)
}

function Root() {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession())
  const [view, setView] = useState<ViewMode>(() => readViewMode())
  const demo = loadDemo() || new URLSearchParams(window.location.search).get('demo') === '1'

  const onMemberViewChange = useCallback((next: MemberView) => {
    saveLayoutView(next)
    setView(next)
    writeViewParam(next)
  }, [])

  // 成员：只有手机视图 / 网页视图，不做左右对照
  if (session?.role === 'member') {
    const layout: MemberView =
      view === 'pc'
        ? 'pc'
        : view === 'mobile'
          ? 'mobile'
          : loadLayoutView() || (isPhoneViewport() ? 'mobile' : 'pc')
    return (
      <App
        key={`member-${layout}`}
        layout={layout}
        memberView={layout}
        onMemberViewChange={onMemberViewChange}
        onSessionChange={setSession}
      />
    )
  }

  if (view === 'mobile') {
    return <App layout="mobile" onSessionChange={setSession} />
  }

  if (view === 'pc') {
    return <App layout="pc" onSessionChange={setSession} />
  }

  // mobilepc / 电脑默认：未登录先单页；管理员登录后左右对照
  if (!session && !demo) {
    return <App layout="pc" onSessionChange={setSession} />
  }

  return <DualPreview onSessionChange={setSession} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
