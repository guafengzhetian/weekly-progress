import { useState } from 'react'
import App from './App'
import Select from './components/Select'
import { loadDemo } from './lib/storage'
import type { AuthSession } from './lib/auth'
import './App.css'
import './DualPreview.css'

function readDemoFlag(): boolean {
  if (typeof window === 'undefined') return false
  if (new URLSearchParams(window.location.search).get('demo') === '1') return true
  return loadDemo()
}

const VIEW_OPTIONS = [
  { value: '__admin__', label: '管理视角' },
  { value: 'cc', label: '成员 · cc' },
  { value: '番茄', label: '成员 · 番茄' },
]

export default function DualPreview({
  onSessionChange,
}: {
  onSessionChange?: (session: AuthSession | null) => void
} = {}) {
  const [perspective, setPerspective] = useState<'admin' | 'member'>('admin')
  const [viewAs, setViewAs] = useState('cc')
  const [phoneKey, setPhoneKey] = useState(0)
  const [deskKey, setDeskKey] = useState(0)
  const demoMode = readDemoFlag()

  const phoneLabel = '成员手机'
  const deskTitle = perspective === 'admin' ? '管理员电脑' : '网页端·成员'
  const deskChrome =
    perspective === 'admin' ? '进度看板' : `成员 · ${viewAs}`
  const viewValue = perspective === 'admin' ? '__admin__' : viewAs

  const onViewChange = (value: string) => {
    if (value === '__admin__') {
      setPerspective('admin')
      return
    }
    setViewAs(value)
    setPerspective('member')
  }

  return (
    <div className="dual">
      <header className="dual-top">
        <div>
          <p className="dual-brand">周报进度</p>
          <p className="dual-sub">左手机 · 右电脑</p>
        </div>
        <div className="dual-top-controls">
          <div className="dual-member-select">
            <Select
              variant="pill"
              value={viewValue}
              options={VIEW_OPTIONS}
              onChange={onViewChange}
              placeholder="切换视角"
            />
          </div>
        </div>
      </header>

      <div className="dual-grid">
        <section className="dual-pane dual-pane-phone">
          <div className="dual-label">
            <span>{phoneLabel}</span>
            <div className="dual-label-end">
              <em>{viewAs}</em>
              <button
                type="button"
                className="dual-refresh"
                onClick={() => setPhoneKey((k) => k + 1)}
              >
                刷新
              </button>
            </div>
          </div>
          <div className="phone-shell">
            <div className="phone-notch" aria-hidden />
            <div className="phone-screen">
              <App
                key={`phone-${phoneKey}-${viewAs}`}
                variant="phone"
                demoMode={demoMode}
                asAdminAccount={false}
                hidePerspectiveSwitch
                perspective={perspective}
                viewAs={viewAs}
                onViewAsChange={setViewAs}
                onSessionChange={onSessionChange}
              />
            </div>
          </div>
        </section>

        <section className="dual-pane dual-pane-desk">
          <div className="dual-label">
            <span>{deskTitle}</span>
            <div className="dual-label-end">
              <em>{perspective === 'admin' ? '看板' : viewAs}</em>
              <button
                type="button"
                className="dual-refresh"
                onClick={() => setDeskKey((k) => k + 1)}
              >
                刷新
              </button>
            </div>
          </div>
          <div className="desk-shell">
            <div className="desk-chrome" aria-hidden>
              <i />
              <i />
              <i />
              <span>{deskChrome}</span>
            </div>
            <div className="desk-screen">
              <App
                key={`desk-${deskKey}-${perspective}-${viewAs}`}
                variant="desktop"
                demoMode={demoMode}
                asAdminAccount
                hidePerspectiveSwitch
                perspective={perspective}
                onPerspectiveChange={setPerspective}
                viewAs={viewAs}
                onViewAsChange={setViewAs}
                onSessionChange={onSessionChange}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
