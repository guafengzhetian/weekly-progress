import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getFile,
  listDir,
  putFile,
  testConnection,
  GitApiError,
} from './lib/github'
import {
  loadDemo,
  loadSettings,
  saveDemo,
  saveSettings,
  settingsReady,
} from './lib/storage'
import { DEMO_PRODUCTS, demoBoardReports, demoMyHistory } from './lib/demo'
import { SEED_PRODUCTS } from './lib/seed'
import Select from './components/Select'
import {
  currentWeekId,
  onTimeLabel,
  productsPath,
  reportPath,
  userReportsDir,
  usersDir,
  weekLabel,
} from './lib/week'
import type {
  Product,
  ProductsFile,
  ReportListItem,
  Settings,
  UserRole,
  WeeklyReport,
} from './types'
import './App.css'

type Tab = 'board' | 'submit' | 'history' | 'products' | 'settings'

function uid(): string {
  return crypto.randomUUID().slice(0, 8)
}

function navItems(role: UserRole): { id: Tab; label: string }[] {
  if (role === 'admin') {
    return [
      { id: 'board', label: '进度看板' },
      { id: 'products', label: '产品' },
      { id: 'settings', label: '设置' },
    ]
  }
  return [
    { id: 'submit', label: '提交周报' },
    { id: 'history', label: '历史进度' },
    { id: 'settings', label: '设置' },
  ]
}

function readDemoFlag(): boolean {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1') {
    return true
  }
  return loadDemo()
}

function readEmbedRole(): UserRole | null {
  if (typeof window === 'undefined') return null
  const embed = new URLSearchParams(window.location.search).get('embed')
  if (embed === 'member' || embed === 'admin') return embed
  return null
}

export type AppProps = {
  /** phone=左侧手机；desktop=右侧电脑；standalone=单独打开 */
  variant?: 'standalone' | 'phone' | 'desktop'
  demoMode?: boolean
  /** 是否具备管理员账号（可切换视角） */
  asAdminAccount?: boolean
  hidePerspectiveSwitch?: boolean
  perspective?: 'admin' | 'member'
  onPerspectiveChange?: (value: 'admin' | 'member') => void
  viewAs?: string
  onViewAsChange?: (name: string) => void
}

export default function App({
  variant = 'standalone',
  demoMode,
  asAdminAccount,
  hidePerspectiveSwitch = false,
  perspective: perspectiveProp,
  onPerspectiveChange,
  viewAs: viewAsProp,
  onViewAsChange,
}: AppProps = {}) {
  const embedRole = useMemo(() => readEmbedRole(), [])
  const embedded = variant !== 'standalone' || embedRole !== null
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [demo, setDemo] = useState(
    () => demoMode ?? (readDemoFlag() || readEmbedRole() !== null),
  )
  const [tab, setTab] = useState<Tab>(() => {
    if (variant === 'phone') return 'submit'
    if (variant === 'desktop') return 'board'
    const embed = readEmbedRole()
    if (embed === 'admin') return 'board'
    if (embed === 'member') return 'submit'
    return loadSettings().role === 'admin' ? 'board' : 'submit'
  })
  const [products, setProducts] = useState<Product[]>(() =>
    demoMode || readDemoFlag() || readEmbedRole() || variant !== 'standalone'
      ? DEMO_PRODUCTS
      : [],
  )
  const [productsSha, setProductsSha] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [perspectiveLocal, setPerspectiveLocal] = useState<'admin' | 'member'>('admin')
  const [viewAsLocal, setViewAsLocal] = useState('cc')

  const perspective = perspectiveProp ?? perspectiveLocal
  const setPerspective = onPerspectiveChange ?? setPerspectiveLocal
  const viewAs = viewAsProp ?? viewAsLocal
  const setViewAs = onViewAsChange ?? setViewAsLocal

  const weekId = useMemo(() => currentWeekId(), [])
  const ready = demo || settingsReady(settings)
  const accountIsAdmin =
    asAdminAccount ??
    (variant === 'desktop' ||
      (variant === 'standalone' && (embedRole ?? settings.role) === 'admin'))

  const role: UserRole =
    variant === 'phone'
      ? 'member'
      : accountIsAdmin && perspective === 'member'
        ? 'member'
        : accountIsAdmin
          ? 'admin'
          : (embedRole ?? settings.role)

  const actingName =
    role === 'member'
      ? accountIsAdmin || variant === 'phone'
        ? viewAs
        : settings.displayName || (demo ? 'cc' : '')
      : settings.displayName || (demo ? '管理员' : '')

  const memberOptions = useMemo(
    () => [
      { value: 'cc', label: 'cc（鱼鱼拜拜拜）' },
      { value: '番茄', label: '番茄（千面）' },
    ],
    [],
  )
  const items = navItems(role)
  const showSwitch = accountIsAdmin && !hidePerspectiveSwitch && variant !== 'phone'

  useEffect(() => {
    if (demoMode) {
      setDemo(true)
      setProducts(DEMO_PRODUCTS)
    }
  }, [demoMode])

  useEffect(() => {
    if (!accountIsAdmin && variant === 'standalone') setPerspectiveLocal('member')
  }, [accountIsAdmin, variant])

  useEffect(() => {
    if (!items.some((i) => i.id === tab)) {
      setTab(items[0].id)
    }
  }, [items, tab])

  useEffect(() => {
    if (variant === 'phone') {
      setTab('submit')
      return
    }
    if (accountIsAdmin && perspective === 'admin') setTab('board')
    if (accountIsAdmin && perspective === 'member') setTab('submit')
  }, [perspective, accountIsAdmin, variant])

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }

  const showError = (e: unknown) => {
    if (e instanceof GitApiError) {
      setError(`${e.message}（${e.status}）`)
    } else if (e instanceof Error) {
      setError(e.message)
    } else {
      setError(String(e))
    }
  }

  const refreshProducts = useCallback(async () => {
    if (demo) {
      setProducts(DEMO_PRODUCTS)
      setProductsSha(undefined)
      return
    }
    if (!settingsReady(settings)) return
    setLoading(true)
    setError(null)
    try {
      const file = await getFile(
        settings.provider,
        settings.owner,
        settings.repo,
        productsPath(),
        settings.token,
      )
      if (!file) {
        setProducts([])
        setProductsSha(undefined)
        return
      }
      const data = JSON.parse(file.content) as ProductsFile
      setProducts(Array.isArray(data.products) ? data.products : [])
      setProductsSha(file.sha)
    } catch (e) {
      showError(e)
    } finally {
      setLoading(false)
    }
  }, [demo, settings])

  useEffect(() => {
    if (demo) saveDemo(true)
  }, [demo])

  useEffect(() => {
    if (ready) void refreshProducts()
  }, [ready, refreshProducts])

  const persistSettings = (next: Settings) => {
    setSettings(next)
    saveSettings(next)
  }

  const enableDemo = () => {
    setDemo(true)
    saveDemo(true)
    setProducts(DEMO_PRODUCTS)
    setTab('board')
    showToast('已进入演示模式')
  }

  const disableDemo = () => {
    setDemo(false)
    saveDemo(false)
    setTab(settings.role === 'admin' ? 'board' : 'submit')
    showToast('已退出演示')
  }

  return (
    <div
      className={`app ${role === 'admin' ? 'app-admin' : 'app-member'}${embedded ? ' app-embed' : ''}`}
    >
      <header className="top">
        <div>
          <p className="brand">{role === 'admin' ? '进度看板' : '周报进度'}</p>
          <p className="sub">
            {weekLabel(weekId)}
            {demo
              ? ' · 演示'
              : role === 'admin'
                ? ' · 管理员'
                : accountIsAdmin
                  ? ` · 成员视角 · ${actingName}`
                  : ' · 提交与历史'}
          </p>
        </div>
        <div className="top-actions">
          {showSwitch && (
            <div className="perspective-switch">
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
          )}
          {!embedded && ready && (
            <span className="pill">
              {demo ? '演示账号' : settings.displayName || '未命名'}
            </span>
          )}
          {!embedded && !ready && (
            <button type="button" className="pill warn" onClick={() => setTab('settings')}>
              先配置
            </button>
          )}
          {embedded && role === 'member' && (
            <span className="pill pill-name">{actingName || '成员'}</span>
          )}
        </div>
      </header>

      {showSwitch && perspective === 'member' && (
        <div className="view-as-bar">
          <Select
            label="查看成员"
            value={viewAs}
            options={memberOptions}
            onChange={setViewAs}
          />
        </div>
      )}

      {demo && !embedded && (
        <div className="banner info">
          <span>演示数据，不会写入 Gitee。配好 Token 后可退出演示。</span>
          <button type="button" onClick={disableDemo}>
            退出
          </button>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
      {error && (
        <div className="banner err" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            关闭
          </button>
        </div>
      )}

      <main className="main">
        {tab === 'board' && (
          <BoardPanel
            settings={settings}
            weekId={weekId}
            ready={ready}
            demo={demo}
            onNeedSettings={() => setTab('settings')}
            onBusy={setLoading}
            onError={showError}
            onDemo={enableDemo}
          />
        )}
        {tab === 'submit' && (
          <SubmitPanel
            settings={settings}
            actingName={actingName}
            products={products}
            weekId={weekId}
            ready={ready}
            demo={demo}
            isAdmin={accountIsAdmin}
            onNeedSettings={() => setTab('settings')}
            onNeedProducts={() => {
              if (accountIsAdmin) {
                setPerspective('admin')
                setTab('products')
              } else {
                setTab('settings')
              }
            }}
            onBusy={setLoading}
            onError={showError}
            onOk={showToast}
          />
        )}
        {tab === 'history' && (
          <HistoryPanel
            settings={settings}
            actingName={actingName}
            weekId={weekId}
            ready={ready}
            demo={demo}
            onNeedSettings={() => setTab('settings')}
            onBusy={setLoading}
            onError={showError}
          />
        )}
        {tab === 'products' && (
          <ProductsPanel
            settings={settings}
            products={products}
            productsSha={productsSha}
            ready={ready}
            demo={demo}
            loading={loading}
            onNeedSettings={() => setTab('settings')}
            onChangeProducts={setProducts}
            onChangeSha={setProductsSha}
            onBusy={setLoading}
            onError={showError}
            onOk={showToast}
            onRefresh={() => void refreshProducts()}
          />
        )}
        {tab === 'settings' && (
          <SettingsPanel
            settings={settings}
            demo={demo}
            onSave={(s) => {
              persistSettings(s)
              if (demo) disableDemo()
              showToast('已保存到本机')
              setTab(s.role === 'admin' ? 'board' : 'submit')
            }}
            onBusy={setLoading}
            onError={showError}
            onOk={showToast}
            onDemo={enableDemo}
            onExitDemo={disableDemo}
          />
        )}
      </main>

      {loading && <div className="loading-bar" aria-hidden />}

      <nav className="nav" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}

function BoardPanel({
  settings,
  weekId,
  ready,
  demo,
  onNeedSettings,
  onBusy,
  onError,
  onDemo,
}: {
  settings: Settings
  weekId: string
  ready: boolean
  demo: boolean
  onNeedSettings: () => void
  onBusy: (v: boolean) => void
  onError: (e: unknown) => void
  onDemo: () => void
}) {
  const [weeks, setWeeks] = useState<string[]>([weekId])
  const [selected, setSelected] = useState(weekId)
  const [items, setItems] = useState<ReportListItem[]>([])
  const [loaded, setLoaded] = useState(false)

  const loadWeeks = useCallback(async () => {
    if (demo) {
      setWeeks([weekId])
      return
    }
    if (!settingsReady(settings)) return
    try {
      const users = await listDir(
        settings.provider,
        settings.owner,
        settings.repo,
        usersDir(),
        settings.token,
      )
      const weekSet = new Set<string>([weekId])
      for (const user of users.filter((d) => d.type === 'dir')) {
        const files = await listDir(
          settings.provider,
          settings.owner,
          settings.repo,
          `${user.path}/reports`,
          settings.token,
        )
        for (const f of files) {
          if (f.type === 'file' && f.name.endsWith('.json')) {
            weekSet.add(f.name.replace(/\.json$/, ''))
          }
        }
      }
      setWeeks([...weekSet].sort().reverse())
    } catch {
      setWeeks([weekId])
    }
  }, [demo, settings, weekId])

  const load = useCallback(async () => {
    if (!ready) return
    onBusy(true)
    try {
      if (demo) {
        const reports = demoBoardReports(selected)
        setItems(
          reports.map((report) => ({
            path: reportPath(report.author, report.week),
            author: report.author,
            report,
          })),
        )
        setLoaded(true)
        return
      }
      const users = await listDir(
        settings.provider,
        settings.owner,
        settings.repo,
        usersDir(),
        settings.token,
      )
      const next: ReportListItem[] = []
      for (const user of users.filter((d) => d.type === 'dir')) {
        const path = `${user.path}/reports/${selected}.json`
        try {
          const file = await getFile(
            settings.provider,
            settings.owner,
            settings.repo,
            path,
            settings.token,
          )
          if (!file) continue
          const report = JSON.parse(file.content) as WeeklyReport
          next.push({
            path,
            author: report.author || user.name,
            report,
          })
        } catch (e) {
          next.push({
            path,
            author: user.name,
            report: null,
            error: e instanceof Error ? e.message : String(e),
          })
        }
      }
      next.sort((a, b) => (b.report?.progress ?? 0) - (a.report?.progress ?? 0))
      setItems(next)
      setLoaded(true)
    } catch (e) {
      onError(e)
    } finally {
      onBusy(false)
    }
  }, [ready, demo, selected, settings, onBusy, onError])

  useEffect(() => {
    void loadWeeks()
  }, [loadWeeks])

  useEffect(() => {
    void load()
  }, [load])

  if (!ready) {
    return (
      <Empty
        title="管理员看板"
        desc="配置 Gitee 后可看全员进度；也可以先看演示效果。"
        action="去设置"
        onAction={onNeedSettings}
        secondary="先看演示"
        onSecondary={onDemo}
      />
    )
  }

  const valid = items.filter((i) => i.report)
  const avg =
    valid.length === 0
      ? 0
      : Math.round(
          valid.reduce((sum, i) => sum + (i.report?.progress ?? 0), 0) / valid.length,
        )

  return (
    <section className="card-block board-panel">
      <div className="row-between board-toolbar">
        <div>
          <h1>团队进度看板</h1>
          <p className="hint">电脑端查看全员周报与项目进度，成员看不到此页</p>
        </div>
        <div className="board-actions">
          <div className="week-field">
            <Select
              label="周次"
              value={selected}
              options={weeks.map((w) => ({
                value: w,
                label: `${weekLabel(w)}${w === weekId ? '（本周）' : ''}`,
              }))}
              onChange={setSelected}
            />
          </div>
          <button type="button" className="ghost" onClick={() => void load()}>
            刷新
          </button>
        </div>
      </div>

      <div className="stats">
        <div>
          <strong>{valid.length}</strong>
          <span>本周已提交</span>
        </div>
        <div>
          <strong>{avg}%</strong>
          <span>平均进度</span>
        </div>
        <div>
          <strong>
            {valid.filter((i) => i.report && onTimeLabel(selected, i.report.updatedAt) === '按时').length}
          </strong>
          <span>按时提交</span>
        </div>
      </div>

      {loaded && items.length === 0 && (
        <p className="empty-text">这周还没人交。</p>
      )}

      <div className="board-table-wrap">
        <table className="board-table">
          <thead>
            <tr>
              <th>成员</th>
              <th>产品</th>
              <th>进度</th>
              <th>是否按时</th>
              <th>上周做了什么</th>
              <th>下周计划</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) =>
              item.report ? (
                <tr key={item.path}>
                  <td className="col-name">{item.report.author}</td>
                  <td>{item.report.productName}</td>
                  <td className="col-progress">
                    <div className="progress-cell">
                      <strong>{item.report.progress}%</strong>
                      <div className="bar">
                        <i style={{ width: `${item.report.progress}%` }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <StatusPill
                      status={onTimeLabel(item.report.week, item.report.updatedAt)}
                    />
                  </td>
                  <td className="col-text">{item.report.lastWeek}</td>
                  <td className="col-text">{item.report.nextWeek}</td>
                </tr>
              ) : (
                <tr key={item.path}>
                  <td colSpan={6}>
                    {item.author}：读取失败 {item.error}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <ul className="report-list board-cards-mobile">
        {items.map((item) => (
          <li key={`m-${item.path}`}>
            {item.report ? (
              <>
                <div className="report-head">
                  <strong>{item.report.author}</strong>
                  <StatusPill
                    status={onTimeLabel(item.report.week, item.report.updatedAt)}
                  />
                </div>
                <ReportCard report={item.report} hideAuthor />
              </>
            ) : (
              <p className="body">
                {item.author}：读取失败 {item.error}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function HistoryPanel({
  settings,
  actingName,
  weekId,
  ready,
  demo,
  onNeedSettings,
  onBusy,
  onError,
}: {
  settings: Settings
  actingName: string
  weekId: string
  ready: boolean
  demo: boolean
  onNeedSettings: () => void
  onBusy: (v: boolean) => void
  onError: (e: unknown) => void
}) {
  const [items, setItems] = useState<WeeklyReport[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!ready) return
    onBusy(true)
    try {
      if (demo) {
        setItems(demoMyHistory(actingName || 'cc'))
        setLoaded(true)
        return
      }
      const dir = userReportsDir(actingName)
      const files = await listDir(
        settings.provider,
        settings.owner,
        settings.repo,
        dir,
        settings.token,
      )
      const weekFiles = files
        .filter((f) => f.type === 'file' && f.name.endsWith('.json'))
        .sort((a, b) => b.name.localeCompare(a.name))
      const next: WeeklyReport[] = []
      for (const f of weekFiles) {
        const file = await getFile(
          settings.provider,
          settings.owner,
          settings.repo,
          f.path,
          settings.token,
        )
        if (!file) continue
        const report = JSON.parse(file.content) as WeeklyReport
        if (report.author && report.author !== actingName) continue
        next.push(report)
      }
      setItems(next)
      setLoaded(true)
    } catch (e) {
      if (e instanceof GitApiError && e.status === 404) {
        setItems([])
        setLoaded(true)
      } else {
        onError(e)
      }
    } finally {
      onBusy(false)
    }
  }, [ready, demo, settings, actingName, onBusy, onError])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const map = new Map<string, WeeklyReport[]>()
    for (const report of items) {
      const key = report.productName || '未分类产品'
      const list = map.get(key) || []
      list.push(report)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [items])

  if (!ready) {
    return (
      <Empty
        title="历史进度"
        desc="配置后只能看到自己的周报。"
        action="去设置"
        onAction={onNeedSettings}
      />
    )
  }

  return (
    <section className="card-block">
      <div className="row-between">
        <h1>历史进度</h1>
        <button type="button" className="ghost" onClick={() => void load()}>
          刷新
        </button>
      </div>
      <p className="hint">
        按产品分组 · 周结束后 10 天内提交算按时 · 当前：{actingName || '未命名'}
      </p>

      <div className="week-status-list">
        <p className="label">周提交情况</p>
        {items.length === 0 && loaded && (
          <p className="empty-text">还没有周提交记录</p>
        )}
        <ul>
          {items.map((report) => {
            const status = onTimeLabel(report.week, report.updatedAt)
            return (
              <li key={`week-${report.week}-${report.productId}`}>
                <span>
                  {weekLabel(report.week)}
                  {report.week === weekId ? '（本周）' : ''}
                  <small> · {report.productName}</small>
                </span>
                <StatusPill status={status} />
              </li>
            )
          })}
        </ul>
      </div>

      {loaded && items.length === 0 && (
        <p className="empty-text">还没有历史记录，先去提交本周进度。</p>
      )}

      {grouped.map(([productName, reports]) => (
        <div className="history-group" key={productName}>
          <h2>{productName}</h2>
          <ul className="report-list">
            {reports.map((report) => (
              <li key={`${report.week}-${report.author}-${report.productId}`}>
                <div className="report-head">
                  <strong>
                    {weekLabel(report.week)}
                    {report.week === weekId ? ' · 本周' : ''}
                  </strong>
                  <StatusPill status={onTimeLabel(report.week, report.updatedAt)} />
                </div>
                <ReportCard report={report} hideAuthor hideProduct />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

function StatusPill({ status }: { status: '按时' | '逾期' | '未交' }) {
  const cls =
    status === '按时' ? 'ok' : status === '逾期' ? 'late' : 'miss'
  return <span className={`status-pill ${cls}`}>{status}</span>
}

function ReportCard({
  report,
  hideAuthor,
  hideProduct,
}: {
  report: WeeklyReport
  hideAuthor?: boolean
  hideProduct?: boolean
}) {
  return (
    <>
      {!hideAuthor || !hideProduct ? (
        <div className="report-head">
          <strong>{hideAuthor ? report.productName : report.author}</strong>
          <span>{report.progress}%</span>
        </div>
      ) : (
        <div className="report-head">
          <strong>进度 {report.progress}%</strong>
          <span />
        </div>
      )}
      {!hideAuthor && !hideProduct && <p className="meta">{report.productName}</p>}
      {!hideProduct && hideAuthor && null}
      <div className="bar">
        <i style={{ width: `${report.progress}%` }} />
      </div>
      <p className="label">上周</p>
      <p className="body">{report.lastWeek}</p>
      <p className="label">下周</p>
      <p className="body">{report.nextWeek}</p>
    </>
  )
}

function SubmitPanel({
  settings,
  actingName,
  products,
  weekId,
  ready,
  demo,
  isAdmin,
  onNeedSettings,
  onNeedProducts,
  onBusy,
  onError,
  onOk,
}: {
  settings: Settings
  actingName: string
  products: Product[]
  weekId: string
  ready: boolean
  demo: boolean
  isAdmin: boolean
  onNeedSettings: () => void
  onNeedProducts: () => void
  onBusy: (v: boolean) => void
  onError: (e: unknown) => void
  onOk: (msg: string) => void
}) {
  const [productId, setProductId] = useState('')
  const [progress, setProgress] = useState(50)
  const [lastWeek, setLastWeek] = useState('')
  const [nextWeek, setNextWeek] = useState('')

  useEffect(() => {
    if (!productId && products.length) setProductId(products[0].id)
  }, [products, productId])

  useEffect(() => {
    if (!ready || demo || !actingName) return
    let cancelled = false
    ;(async () => {
      try {
        const path = reportPath(actingName, weekId)
        const file = await getFile(
          settings.provider,
          settings.owner,
          settings.repo,
          path,
          settings.token,
        )
        if (!file || cancelled) return
        const report = JSON.parse(file.content) as WeeklyReport
        if (report.author && report.author !== actingName) return
        setProductId(report.productId || '')
        setProgress(report.progress ?? 50)
        setLastWeek(report.lastWeek || '')
        setNextWeek(report.nextWeek || '')
      } catch {
        /* first submit */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ready, demo, settings, weekId, actingName])

  if (!ready) {
    return (
      <Empty
        title="还没配置仓库"
        desc="先填 Token、仓库和名字。"
        action="去设置"
        onAction={onNeedSettings}
      />
    )
  }

  if (!products.length) {
    return (
      <Empty
        title="还没有产品"
        desc={
          isAdmin
            ? '先在「产品」里加几个产品名。'
            : '请让管理员先在「产品」里添加产品。'
        }
        action={isAdmin ? '去加产品' : '去设置'}
        onAction={onNeedProducts}
      />
    )
  }

  const submit = async () => {
    const product = products.find((p) => p.id === productId)
    if (!product) {
      onError(new Error('请选择产品'))
      return
    }
    if (!actingName.trim()) {
      onError(new Error('请先设置显示名'))
      return
    }
    if (!lastWeek.trim() || !nextWeek.trim()) {
      onError(new Error('上周和下周内容都要填'))
      return
    }
    if (demo) {
      onOk('演示模式：未写入 Gitee')
      return
    }
    onBusy(true)
    try {
      const path = reportPath(actingName, weekId)
      const existing = await getFile(
        settings.provider,
        settings.owner,
        settings.repo,
        path,
        settings.token,
      )
      const report: WeeklyReport = {
        week: weekId,
        productId: product.id,
        productName: product.name,
        author: actingName,
        progress: Math.min(100, Math.max(0, Number(progress) || 0)),
        lastWeek: lastWeek.trim(),
        nextWeek: nextWeek.trim(),
        updatedAt: new Date().toISOString(),
      }
      await putFile(
        settings.provider,
        settings.owner,
        settings.repo,
        path,
        settings.token,
        `weekly: ${actingName} ${weekId} ${report.progress}%`,
        JSON.stringify(report, null, 2) + '\n',
        existing?.sha,
      )
      onOk('已提交到 Gitee')
    } catch (e) {
      onError(e)
    } finally {
      onBusy(false)
    }
  }

  return (
    <section className="card-block">
      <h1>提交周报</h1>
      <p className="hint">
        填写进度、上周 / 下周 · 提交人：{actingName || '未命名'}
      </p>

      <Select
        label="产品"
        value={productId}
        options={products.map((p) => ({
          value: p.id,
          label: p.name,
        }))}
        onChange={setProductId}
      />

      <label className="field">
        <span>进度 {progress}%</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
        />
      </label>

      <label className="field">
        <span>上周做了什么</span>
        <textarea
          rows={4}
          value={lastWeek}
          onChange={(e) => setLastWeek(e.target.value)}
          placeholder="例如：完成登录页、联调接口…"
        />
      </label>

      <label className="field">
        <span>下周计划做什么</span>
        <textarea
          rows={4}
          value={nextWeek}
          onChange={(e) => setNextWeek(e.target.value)}
          placeholder="例如：做首页、补测试…"
        />
      </label>

      <button type="button" className="primary" onClick={() => void submit()}>
        {demo ? '演示提交' : '提交到 Gitee'}
      </button>
    </section>
  )
}

function ProductsPanel({
  settings,
  products,
  productsSha,
  ready,
  demo,
  loading,
  onNeedSettings,
  onChangeProducts,
  onChangeSha,
  onBusy,
  onError,
  onOk,
  onRefresh,
}: {
  settings: Settings
  products: Product[]
  productsSha?: string
  ready: boolean
  demo: boolean
  loading: boolean
  onNeedSettings: () => void
  onChangeProducts: (p: Product[]) => void
  onChangeSha: (sha?: string) => void
  onBusy: (v: boolean) => void
  onError: (e: unknown) => void
  onOk: (msg: string) => void
  onRefresh: () => void
}) {
  const [name, setName] = useState('')

  if (!ready) {
    return (
      <Empty
        title="还没配置仓库"
        desc="产品列表存在仓库的 products.json。"
        action="去设置"
        onAction={onNeedSettings}
      />
    )
  }

  const save = async (next: Product[]) => {
    if (demo) {
      onChangeProducts(next)
      onOk('演示模式：仅本机生效')
      return
    }
    onBusy(true)
    try {
      const payload: ProductsFile = { products: next }
      await putFile(
        settings.provider,
        settings.owner,
        settings.repo,
        productsPath(),
        settings.token,
        `products: update (${next.length})`,
        JSON.stringify(payload, null, 2) + '\n',
        productsSha,
      )
      const file = await getFile(
        settings.provider,
        settings.owner,
        settings.repo,
        productsPath(),
        settings.token,
      )
      onChangeProducts(next)
      onChangeSha(file?.sha)
      onOk('产品列表已更新')
    } catch (e) {
      onError(e)
    } finally {
      onBusy(false)
    }
  }

  const add = () => {
    const n = name.trim()
    if (!n) return
    void save([...products, { id: uid(), name: n }])
    setName('')
  }

  const remove = (id: string) => {
    void save(products.filter((p) => p.id !== id))
  }

  return (
    <section className="card-block">
      <div className="row-between">
        <h1>产品列表</h1>
        <button type="button" className="ghost" onClick={onRefresh} disabled={loading}>
          刷新
        </button>
      </div>
      <p className="hint">由你（管理员）维护；成员提交时只能选择，不能改</p>

      {!products.length && (
        <button
          type="button"
          className="primary"
          style={{ marginBottom: 14 }}
          onClick={() => void save(SEED_PRODUCTS)}
        >
          一键写入：鱼鱼拜拜拜 + 千面
        </button>
      )}

      <div className="add-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新产品名称"
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
        />
        <button type="button" className="primary slim" onClick={add}>
          添加
        </button>
      </div>

      <ul className="product-list">
        {products.map((p) => (
          <li key={p.id}>
            <div className="product-meta">
              <span>{p.name}</span>
              {p.ownerHint && <small>{p.ownerHint}</small>}
            </div>
            <button type="button" className="ghost danger" onClick={() => remove(p.id)}>
              删除
            </button>
          </li>
        ))}
        {!products.length && <li className="empty-text">还没有产品，可点上面一键写入</li>}
      </ul>
    </section>
  )
}

function SettingsPanel({
  settings,
  demo,
  onSave,
  onBusy,
  onError,
  onOk,
  onDemo,
  onExitDemo,
}: {
  settings: Settings
  demo: boolean
  onSave: (s: Settings) => void
  onBusy: (v: boolean) => void
  onError: (e: unknown) => void
  onOk: (msg: string) => void
  onDemo: () => void
  onExitDemo: () => void
}) {
  const [form, setForm] = useState<Settings>(settings)

  useEffect(() => setForm(settings), [settings])

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const test = async () => {
    onBusy(true)
    try {
      const name = await testConnection(
        form.provider,
        form.owner.trim(),
        form.repo.trim(),
        form.token.trim(),
      )
      onOk(`连接成功：${name}`)
    } catch (e) {
      onError(e)
    } finally {
      onBusy(false)
    }
  }

  return (
    <section className="card-block">
      <h1>设置</h1>
      <p className="hint">
        Token 只存在本机浏览器。成员选「成员」，你选「管理员」。
      </p>

      <div className="split-note">
        <strong>两个仓库，别混用</strong>
        <p>
          <em>weekly-progress</em>（可公开）只挂网页；下面填的是私有仓
          <em>private-database</em>，进度只写这里，外人看不到。
        </p>
      </div>

      <Select
        label="身份"
        value={form.role}
        options={[
          { value: 'member', label: '成员（手机：提交周报 + 历史进度）' },
          { value: 'admin', label: '管理员（电脑：进度看板）' },
        ]}
        onChange={(v) => set('role', v as UserRole)}
      />

      <Select
        label="Git 平台"
        value={form.provider}
        options={[
          { value: 'gitee', label: 'Gitee' },
          { value: 'github', label: 'GitHub' },
        ]}
        onChange={(v) => set('provider', v as Settings['provider'])}
      />

      <label className="field">
        <span>数据仓主人（owner）</span>
        <input
          value={form.owner}
          onChange={(e) => set('owner', e.target.value)}
          placeholder="space-invincible-hair"
          autoCapitalize="off"
          autoCorrect="off"
        />
      </label>

      <label className="field">
        <span>私有数据仓名（repo）</span>
        <input
          value={form.repo}
          onChange={(e) => set('repo', e.target.value)}
          placeholder="private-database"
          autoCapitalize="off"
          autoCorrect="off"
        />
      </label>

      <label className="field">
        <span>私人令牌 Token（要有数据仓权限）</span>
        <input
          type="password"
          value={form.token}
          onChange={(e) => set('token', e.target.value)}
          placeholder="Gitee 私人令牌"
          autoCapitalize="off"
          autoCorrect="off"
        />
      </label>

      <label className="field">
        <span>你的显示名</span>
        <input
          value={form.displayName}
          onChange={(e) => set('displayName', e.target.value)}
          placeholder="例如 小张"
        />
      </label>

      <div className="btn-row">
        <button type="button" className="ghost" onClick={() => void test()}>
          测试连接
        </button>
        <button
          type="button"
          className="primary"
          onClick={() =>
            onSave({
              ...form,
              owner: form.owner.trim(),
              repo: form.repo.trim(),
              token: form.token.trim(),
              displayName: form.displayName.trim(),
            })
          }
        >
          保存
        </button>
      </div>

      <div className="btn-row" style={{ marginTop: 10 }}>
        {demo ? (
          <button type="button" className="ghost" onClick={onExitDemo}>
            退出演示
          </button>
        ) : (
          <button type="button" className="ghost" onClick={onDemo}>
            先看演示效果
          </button>
        )}
      </div>

      <ol className="steps">
        <li>
          使用私有仓 <code>private-database</code> 存进度（空仓即可）
        </li>
        <li>把两名成员加成该私有仓协作成员</li>
        <li>私人令牌勾选 projects，填到上面并「测试连接」</li>
        <li>
          公开仓 <code>weekly-progress</code> 只用来挂 Pages 网页，不要往里面写进度
        </li>
      </ol>
    </section>
  )
}

function Empty({
  title,
  desc,
  action,
  onAction,
  secondary,
  onSecondary,
}: {
  title: string
  desc: string
  action: string
  onAction: () => void
  secondary?: string
  onSecondary?: () => void
}) {
  return (
    <section className="empty">
      <h1>{title}</h1>
      <p>{desc}</p>
      <button type="button" className="primary" onClick={onAction}>
        {action}
      </button>
      {secondary && onSecondary && (
        <button type="button" className="ghost" style={{ marginTop: 10, width: '100%' }} onClick={onSecondary}>
          {secondary}
        </button>
      )}
    </section>
  )
}
