import { useState } from 'react'
import App from './App'
import Select from './components/Select'
import './App.css'
import './DualPreview.css'

const MEMBER_OPTIONS = [
  { value: 'cc', label: 'cc' },
  { value: '番茄', label: '番茄' },
]

export default function DualPreview() {
  const [perspective, setPerspective] = useState<'admin' | 'member'>('admin')
  const [viewAs, setViewAs] = useState('cc')
  const [phoneKey, setPhoneKey] = useState(0)
  const [deskKey, setDeskKey] = useState(0)

  const phoneLabel = '成员手机'
  const deskTitle = perspective === 'admin' ? '管理员电脑' : '网页端·成员'
  const deskChrome =
    perspective === 'admin' ? '进度看板' : `成员 · ${viewAs}`

  return (
    <div className="dual">
      <header className="dual-top">
        <div>
          <p className="dual-brand">周报进度 · 对照预览</p>
          <p className="dual-sub">
            右侧切换视角时，左侧手机同步；成员用下拉切换
          </p>
        </div>
        <div className="dual-top-controls">
          <div className="perspective-switch perspective-switch-page">
            <button
              type="button"
              className={perspective === 'admin' ? 'active' : ''}
              onClick={() => setPerspective('admin')}
            >
              管理视角
            </button>
            <button
              type="button"
              className={perspective === 'member' ? 'active' : ''}
              onClick={() => setPerspective('member')}
            >
              成员视角
            </button>
          </div>
          <div className="dual-member-select">
            <Select
              label="成员"
              value={viewAs}
              options={MEMBER_OPTIONS}
              onChange={setViewAs}
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
                demoMode
                asAdminAccount={false}
                hidePerspectiveSwitch
                perspective={perspective}
                viewAs={viewAs}
                onViewAsChange={setViewAs}
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
                demoMode
                asAdminAccount
                hidePerspectiveSwitch
                perspective={perspective}
                onPerspectiveChange={setPerspective}
                viewAs={viewAs}
                onViewAsChange={setViewAs}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
