import './DualPreview.css'

export default function DualPreview() {
  return (
    <div className="dual">
      <header className="dual-top">
        <div>
          <p className="dual-brand">周报进度 · 对照预览</p>
          <p className="dual-sub">左侧成员手机端 · 右侧管理员电脑端</p>
        </div>
      </header>

      <div className="dual-grid">
        <section className="dual-pane dual-pane-phone">
          <div className="dual-label">
            <span>成员</span>
            <em>手机</em>
          </div>
          <div className="phone-shell">
            <div className="phone-notch" aria-hidden />
            <iframe
              title="成员手机端"
              src="./?demo=1&embed=member"
              className="phone-iframe"
            />
          </div>
        </section>

        <section className="dual-pane dual-pane-desk">
          <div className="dual-label">
            <span>管理员</span>
            <em>电脑网页</em>
          </div>
          <div className="desk-shell">
            <div className="desk-chrome" aria-hidden>
              <i />
              <i />
              <i />
              <span>进度看板</span>
            </div>
            <iframe
              title="管理员电脑端"
              src="./?demo=1&embed=admin"
              className="desk-iframe"
            />
          </div>
        </section>
      </div>
    </div>
  )
}
