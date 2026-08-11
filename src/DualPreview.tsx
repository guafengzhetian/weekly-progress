import { useState } from 'react'
import App from './App'
import './DualPreview.css'

export default function DualPreview() {
  const [perspective, setPerspective] = useState<'admin' | 'member'>('admin')
  const [viewAs, setViewAs] = useState('cc')

  return (
    <div className="dual">
      <header className="dual-top">
        <div>
          <p className="dual-brand">周报进度 · 对照预览</p>
          <p className="dual-sub">
            右侧切换管理/成员视角时，左侧手机同步变化
            {perspective === 'member' ? `（当前：${viewAs}）` : ''}
          </p>
        </div>
      </header>

      <div className="dual-grid">
        <section className="dual-pane dual-pane-phone">
          <div className="dual-label">
            <span>成员手机</span>
            <em>{viewAs}</em>
          </div>
          <div className="phone-shell">
            <div className="phone-notch" aria-hidden />
            <div className="phone-screen">
              <App
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
            <span>{perspective === 'admin' ? '管理员电脑' : '成员视角·电脑'}</span>
            <em>{perspective === 'admin' ? '看板' : viewAs}</em>
          </div>
          <div className="desk-shell">
            <div className="desk-chrome" aria-hidden>
              <i />
              <i />
              <i />
              <span>{perspective === 'admin' ? '进度看板' : `成员 · ${viewAs}`}</span>
            </div>
            <div className="desk-screen">
              <App
                variant="desktop"
                demoMode
                asAdminAccount
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
