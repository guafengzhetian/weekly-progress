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
import { demoBoardReports, demoMyHistory, getDemoReport, loadDemoProducts, saveDemoProducts, saveDemoReport } from './lib/demo'
import { SEED_PRODUCTS, TEAM_MEMBERS, addMonths, getDeadlineInfo, normalizeProduct, productsForMember } from './lib/seed'
import Select from './components/Select'
import {
  currentWeekId,
  onTimeLabel,
  productsPath,
  reportPath,
  userReportsDir,
  usersDir,
  weekLabel,
  weekStartUtc,
} from './lib/week'
import type {
  Product,
  ProductsFile,
  ReportListItem,
  Settings,
  UserRole,
  WeeklyReport,
} from './types'
import pixelCatThumbs from './assets/pixel-cat-thumbs.png'
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
  ]
}

function DeadlineCountdown({
  deadline,
  compact = false,
  inline = false,
}: {
  deadline?: string
  compact?: boolean
  /** 标题行右侧：单行、不换行 */
  inline?: boolean
}) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  const info = useMemo(() => getDeadlineInfo(deadline, now), [deadline, now])
  if (!info) return null
  return (
    <p
      className={`deadline-countdown${info.overdue ? ' is-overdue' : ''}${info.urgent ? ' is-urgent' : ''}${compact ? ' is-compact' : ''}${inline ? ' is-inline' : ''}`}
    >
      {inline ? (
        <>
          截止 {info.dateLabel}
          <strong>{info.text}</strong>
        </>
      ) : compact ? (
        <>
          截止 {info.dateLabel.replace(/年/, '/').replace(/月/, '/').replace(/日/, '')} · {info.text}
        </>
      ) : (
        <>
          <span>截止 {info.dateLabel}</span>
          <strong>{info.text}</strong>
        </>
      )}
    </p>
  )
}

function readDemoFlag(): boolean {
  if (typeof window === 'undefined') return false
  // 只有显式 ?demo=1 才进演示；正式打开不沿用本机上次演示状态
  if (new URLSearchParams(window.location.search).get('demo') === '1') {
    return true
  }
  if (loadDemo()) saveDemo(false)
  return false
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
  /** URL 强制布局：mobile / pc（优先于自动判断） */
  layout?: 'mobile' | 'pc'
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
  layout,
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
      ? loadDemoProducts()
      : [],
  )
  const [productsSha, setProductsSha] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [perspectiveLocal, setPerspectiveLocal] = useState<'admin' | 'member'>('admin')
  const [viewAsLocal, setViewAsLocal] = useState('cc')
  const [celebrate, setCelebrate] = useState(false)
  const [celebrateMsg, setCelebrateMsg] = useState('提交成功')
  const [editWeek, setEditWeek] = useState<string | null>(null)

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

  // 布局只靠 URL view=mobile|pc（或 DualPreview 的 variant），不再提供页内切换
  const isPhone = variant === 'phone' || layout === 'mobile'
  const useTopTabs = true
  const hidePanelRefresh = embedded

  const actingName =
    role === 'member'
      ? accountIsAdmin || variant === 'phone'
        ? viewAs
        : settings.displayName || (demo ? 'cc' : '')
      : settings.displayName || (demo ? '管理员' : '')

  const memberOptions = useMemo(
    () => [
      { value: 'cc', label: 'cc' },
      { value: '番茄', label: '番茄' },
    ],
    [],
  )
  const accountOptions = useMemo(
    () => [
      {
        value: '__admin__',
        label: demo ? '管理员' : settings.displayName || '管理员',
      },
      ...memberOptions,
    ],
    [demo, settings.displayName, memberOptions],
  )
  const accountValue =
    accountIsAdmin && perspective === 'member' ? viewAs : '__admin__'

  const onAccountChange = (value: string) => {
    if (value === '__admin__') {
      setPerspective('admin')
      return
    }
    setViewAs(value)
    setPerspective('member')
  }

  const items = navItems(role)
  const loggedIn = !demo && settingsReady(settings)
  const showSettingsEntry = role === 'member' && loggedIn
  const showSwitch = accountIsAdmin && !hidePerspectiveSwitch && variant !== 'phone'
  const showAccount = !isPhone
  const showAccountMenu = showAccount && accountIsAdmin && ready
  const memberProducts = useMemo(
    () => productsForMember(products, actingName),
    [products, actingName],
  )
  const submitProducts = role === 'member' ? memberProducts : products

  useEffect(() => {
    if (demoMode) {
      setDemo(true)
      setProducts(loadDemoProducts())
    }
  }, [demoMode])

  useEffect(() => {
    if (!accountIsAdmin && variant === 'standalone') setPerspectiveLocal('member')
  }, [accountIsAdmin, variant])

  useEffect(() => {
    // 成员设置不在底栏/顶栏 Tab 里，允许从标题下入口进入
    if (tab === 'settings' && role === 'member') return
    if (!items.some((i) => i.id === tab)) {
      setTab(items[0].id)
    }
  }, [items, tab, role])

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

  const celebrateSubmit = (msg: string) => {
    showToast(msg)
    setCelebrateMsg(msg.includes('完成') ? '全部完成' : '提交成功')
    setCelebrate(true)
    window.setTimeout(() => setCelebrate(false), 2600)
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
      setProducts(loadDemoProducts())
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
      const list = Array.isArray(data.products)
        ? data.products.map((p) => normalizeProduct(p))
        : []
      setProducts(list)
      setProductsSha(file.sha)
    } catch (e) {
      showError(e)
    } finally {
      setLoading(false)
    }
  }, [demo, settings])

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
    setProducts(loadDemoProducts())
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
      className={`app ${role === 'admin' ? 'app-admin' : 'app-member'}${embedded ? ' app-embed' : ''}${useTopTabs ? ' app-top-tabs' : ' app-bottom-nav'}`}
    >
      {showSwitch && (
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
      )}

      <header className="top">
        <div className="top-title-row">
          <p className="brand">{role === 'admin' ? '进度看板' : '周报进度'}</p>
          {showAccountMenu && (
            <div className="pill-account">
              <Select
                variant="pill"
                value={accountValue}
                options={accountOptions}
                onChange={onAccountChange}
                placeholder="管理员"
              />
            </div>
          )}
          {showAccount && !showAccountMenu && ready && (
            <span className="pill pill-account">
              {role === 'member'
                ? actingName || '成员'
                : demo
                  ? '管理员'
                  : settings.displayName || '未命名'}
            </span>
          )}
          {showAccount && !ready && (
            <button type="button" className="pill warn" onClick={() => setTab('settings')}>
              先配置
            </button>
          )}
        </div>
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

        {showSettingsEntry && (
          <button
            type="button"
            className={`settings-under${tab === 'settings' ? ' active' : ''}`}
            onClick={() => setTab('settings')}
          >
            设置
          </button>
        )}

        {useTopTabs && (
          <nav className="tabs" aria-label="页面切换">
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
        )}
      </header>

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
            hideRefresh={hidePanelRefresh}
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
            products={submitProducts}
            weekId={weekId}
            editWeek={editWeek ?? weekId}
            onEditWeekChange={setEditWeek}
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
            onOk={celebrateSubmit}
          />
        )}
        {tab === 'history' && (
          <HistoryPanel
            settings={settings}
            actingName={actingName}
            products={products}
            weekId={weekId}
            ready={ready}
            demo={demo}
            hideRefresh={hidePanelRefresh}
            onNeedSettings={() => setTab('settings')}
            onBusy={setLoading}
            onError={showError}
            onEdit={(week) => {
              setEditWeek(week)
              setTab('submit')
            }}
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
            hideRefresh={hidePanelRefresh}
            members={[...TEAM_MEMBERS]}
            onNeedSettings={() => setTab('settings')}
            onChangeProducts={(next) => {
              setProducts(next)
              if (demo) saveDemoProducts(next)
            }}
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

      {celebrate && (
        <div
          className="celebrate"
          role="status"
          onClick={() => setCelebrate(false)}
        >
          <img src={pixelCatThumbs} alt="" className="celebrate-cat" />
          <p>{celebrateMsg}</p>
        </div>
      )}
    </div>
  )
}

function BoardPanel({
  settings,
  weekId,
  ready,
  demo,
  hideRefresh = false,
  onNeedSettings,
  onBusy,
  onError,
  onDemo,
}: {
  settings: Settings
  weekId: string
  ready: boolean
  demo: boolean
  hideRefresh?: boolean
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
        desc="先配置仓库"
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
          {!hideRefresh && (
            <button type="button" className="ghost slim" onClick={() => void load()}>
              刷新
            </button>
          )}
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
  products,
  weekId,
  ready,
  demo,
  hideRefresh = false,
  onNeedSettings,
  onBusy,
  onError,
  onEdit,
}: {
  settings: Settings
  actingName: string
  products: Product[]
  weekId: string
  ready: boolean
  demo: boolean
  hideRefresh?: boolean
  onNeedSettings: () => void
  onBusy: (v: boolean) => void
  onError: (e: unknown) => void
  onEdit: (week: string) => void
}) {
  const [items, setItems] = useState<WeeklyReport[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!ready) return
    onBusy(true)
    try {
      if (demo) {
        setItems(demoMyHistory(actingName || 'cc', products))
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
  }, [ready, demo, settings, actingName, products, onBusy, onError])

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

  const weekPoints = useMemo(() => {
    const byWeek = new Map<string, '按时' | '逾期' | '未交'>()
    for (const report of [...items].sort((a, b) => a.week.localeCompare(b.week))) {
      const status = onTimeLabel(report.week, report.updatedAt)
      const prev = byWeek.get(report.week)
      if (!prev || status === '逾期' || (status === '未交' && prev === '按时')) {
        byWeek.set(report.week, status)
      }
    }
    const weeks = [...byWeek.entries()].map(([week, status]) => ({
      week,
      status: status as '按时' | '逾期' | '未交' | '起点' | '结束',
    }))
    if (weeks.length === 0) return weeks
    const done = items.some((r) => r.progress >= 100)
    return [
      { week: '__start__', status: '起点' as const },
      ...weeks,
      ...(done ? [{ week: '__end__', status: '结束' as const }] : []),
    ]
  }, [items])

  const taskStartAt = useMemo(() => {
    if (items.length === 0) return null
    const earliest = [...items].sort((a, b) => a.week.localeCompare(b.week))[0]
    return weekStartUtc(earliest.week)
  }, [items])

  const lateCount = weekPoints.filter((p) => p.status === '逾期').length

  if (!ready) {
    return (
      <Empty
        title="历史进度"
        desc="先配置仓库"
        action="去设置"
        onAction={onNeedSettings}
      />
    )
  }

  return (
    <section className="card-block">
      <div className="row-between">
        <h1>历史进度</h1>
        {!hideRefresh && (
          <button type="button" className="ghost slim" onClick={() => void load()}>
            刷新
          </button>
        )}
      </div>
      <p className="hint">
        {actingName || '未命名'} · 宽限 10 天
      </p>

      <div className="week-status-chart">
        <div className="row-between">
          <p className="label">周提交情况</p>
          <p className="chart-meta">
            逾期 <strong>{lateCount}</strong> 次
          </p>
        </div>
        {items.length === 0 && loaded && (
          <p className="empty-text">还没有周提交记录</p>
        )}
        {weekPoints.length > 0 && <WeekStatusChart points={weekPoints} />}
        <div className="chart-legend">
          <span>
            <i className="dot ok" /> 按时（绿）
          </span>
          <span>
            <i className="dot late" /> 逾期（红）
          </span>
          <span>
            逾期合计 <strong>{lateCount}</strong> 次
          </span>
        </div>
      </div>

      {loaded && items.length === 0 && (
        <p className="empty-text">还没有历史记录，先去提交本周进度。</p>
      )}

      {grouped.map(([productName, reports]) => {
        const byWeekAsc = [...reports].sort((a, b) => a.week.localeCompare(b.week))
        const byWeekDesc = [...byWeekAsc].reverse()
        const finished = reports.some((r) => r.progress >= 100)
        const productMeta =
          products.find((p) => p.name === productName) ||
          products.find((p) => reports.some((r) => r.productId === p.id))
        const startLabel = taskStartAt
          ? taskStartAt.toLocaleDateString('zh-CN', {
              month: 'numeric',
              day: 'numeric',
            })
          : null
        return (
          <div className="history-group" key={productName}>
            <h2>{productName}</h2>
            <DeadlineCountdown deadline={productMeta?.deadline} compact />
            <ul className="report-list">
              {finished && (
                <li className="milestone-card end">
                  <div className="report-head">
                    <strong>结束 · 全部完成</strong>
                    <span className="status-pill ok">100%</span>
                  </div>
                  <p className="history-delta">
                    <span className="up">进度 100%</span>
                  </p>
                  <div className="bar">
                    <i style={{ width: '100%' }} />
                  </div>
                  <div className="milestone-cat">
                    <img src={pixelCatThumbs} alt="" className="celebrate-cat inline" />
                    <p>搞定啦</p>
                  </div>
                </li>
              )}

              {byWeekDesc.map((report) => {
                const idx = byWeekAsc.findIndex(
                  (r) =>
                    r.week === report.week &&
                    r.productId === report.productId &&
                    r.updatedAt === report.updatedAt,
                )
                const prev = idx > 0 ? byWeekAsc[idx - 1] : undefined
                const dayGap =
                  prev != null
                    ? Math.max(
                        0,
                        Math.round(
                          (new Date(report.updatedAt).getTime() -
                            new Date(prev.updatedAt).getTime()) /
                            86400000,
                        ),
                      )
                    : taskStartAt
                      ? Math.max(
                          0,
                          Math.round(
                            (new Date(report.updatedAt).getTime() -
                              taskStartAt.getTime()) /
                              86400000,
                          ),
                        )
                      : null
                const progressDelta =
                  prev != null ? report.progress - prev.progress : report.progress
                return (
                  <li key={`${report.week}-${report.author}-${report.productId}`}>
                    <div className="report-head">
                      <strong>
                        {weekLabel(report.week)}
                        {report.week === weekId ? ' · 本周' : ''}
                      </strong>
                      <div className="report-head-actions">
                        <StatusPill status={onTimeLabel(report.week, report.updatedAt)} />
                        <button
                          type="button"
                          className="ghost slim"
                          onClick={() => onEdit(report.week)}
                        >
                          编辑
                        </button>
                      </div>
                    </div>
                    <p className="history-delta">
                      {prev == null ? (
                        <>
                          <span>相对起点{dayGap != null ? ` ${dayGap} 天` : ''}</span>
                          <span
                            className={
                              progressDelta > 0 ? 'up' : progressDelta < 0 ? 'down' : 'flat'
                            }
                          >
                            {progressDelta > 0
                              ? `进度 +${progressDelta}%`
                              : progressDelta < 0
                                ? `进度 ${progressDelta}%`
                                : '进度 0%'}
                          </span>
                        </>
                      ) : (
                        <>
                          <span>距上次 {dayGap} 天</span>
                          <span
                            className={
                              progressDelta > 0
                                ? 'up'
                                : progressDelta < 0
                                  ? 'down'
                                  : 'flat'
                            }
                          >
                            {progressDelta > 0
                              ? `进度 +${progressDelta}%`
                              : progressDelta < 0
                                ? `进度 ${progressDelta}%`
                                : '进度持平'}
                          </span>
                        </>
                      )}
                    </p>
                    <ReportCard report={report} hideAuthor hideProduct />
                  </li>
                )
              })}

              <li className="milestone-card start">
                <div className="report-head">
                  <strong>起点 · 任务分发</strong>
                  <span className="status-pill start">初始</span>
                </div>
                {startLabel && (
                  <p className="history-delta">
                    <span>{startLabel} 起</span>
                  </p>
                )}
                <p className="body">任务分发起点，尚未开始周报推进。</p>
              </li>
            </ul>
          </div>
        )
      })}
    </section>
  )
}

function WeekStatusChart({
  points,
}: {
  points: { week: string; status: '按时' | '逾期' | '未交' | '起点' | '结束' }[]
}) {
  const W = 320
  const H = 120
  const padX = 28
  const padY = 22
  const n = points.length
  const xs = points.map((_, i) =>
    n === 1 ? W / 2 : padX + (i * (W - padX * 2)) / (n - 1),
  )
  // 起点居中；结束偏上；按时偏上，逾期偏下
  const ys = points.map((p) =>
    p.status === '起点'
      ? H / 2
      : p.status === '结束'
        ? padY
        : p.status === '逾期'
          ? H - padY
          : p.status === '未交'
            ? H / 2
            : padY + 8,
  )
  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ys[i]}`).join(' ')

  return (
    <svg
      className="week-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="周提交折线图"
    >
      <line
        x1={padX}
        y1={H / 2}
        x2={W - padX}
        y2={H / 2}
        className="chart-axis"
      />
      <path d={line} className="chart-line" fill="none" />
      {points.map((p, i) => (
        <g key={`${p.week}-${p.status}`}>
          <circle
            cx={xs[i]}
            cy={ys[i]}
            r={p.status === '起点' || p.status === '结束' ? 7 : 6}
            className={
              p.status === '起点'
                ? 'chart-dot start'
                : p.status === '结束'
                  ? 'chart-dot end'
                  : p.status === '逾期'
                    ? 'chart-dot late'
                    : p.status === '按时'
                      ? 'chart-dot ok'
                      : 'chart-dot miss'
            }
          />
          <text x={xs[i]} y={H - 4} textAnchor="middle" className="chart-label">
            {p.status === '起点'
              ? '起点'
              : p.status === '结束'
                ? '结束'
                : p.week.split('-W')[1]
                  ? `W${p.week.split('-W')[1]}`
                  : p.week}
          </text>
        </g>
      ))}
    </svg>
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
  editWeek,
  onEditWeekChange,
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
  editWeek: string
  onEditWeekChange: (week: string | null) => void
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
  const [hasExisting, setHasExisting] = useState(false)
  const targetWeek = editWeek || weekId

  useEffect(() => {
    if (!productId && products.length) setProductId(products[0].id)
  }, [products, productId])

  useEffect(() => {
    if (!ready || !actingName) return
    let cancelled = false
    ;(async () => {
      try {
        if (demo) {
          const report = getDemoReport(actingName, targetWeek)
          if (cancelled) return
          if (!report) {
            setHasExisting(false)
            setLastWeek('')
            setNextWeek('')
            setProgress(50)
            return
          }
          setHasExisting(true)
          setProductId(report.productId || '')
          setProgress(report.progress ?? 50)
          setLastWeek(report.lastWeek || '')
          setNextWeek(report.nextWeek || '')
          return
        }
        const path = reportPath(actingName, targetWeek)
        const file = await getFile(
          settings.provider,
          settings.owner,
          settings.repo,
          path,
          settings.token,
        )
        if (cancelled) return
        if (!file) {
          setHasExisting(false)
          setLastWeek('')
          setNextWeek('')
          setProgress(50)
          return
        }
        const report = JSON.parse(file.content) as WeeklyReport
        if (report.author && report.author !== actingName) {
          setHasExisting(false)
          return
        }
        setHasExisting(true)
        setProductId(report.productId || '')
        setProgress(report.progress ?? 50)
        setLastWeek(report.lastWeek || '')
        setNextWeek(report.nextWeek || '')
      } catch {
        if (!cancelled) setHasExisting(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ready, demo, settings, targetWeek, actingName])

  if (!ready) {
    return (
      <Empty
        title="还没配置仓库"
        desc="先填 Token、仓库和名字"
        action="去设置"
        onAction={onNeedSettings}
      />
    )
  }

  if (!products.length) {
    return (
      <Empty
        title={isAdmin ? '还没有产品' : '暂无负责产品'}
        desc={
          isAdmin
            ? '先添加产品并分配给成员'
            : '管理员分配后，你就能在这里看到对应产品'
        }
        action={isAdmin ? '去加产品' : undefined}
        onAction={isAdmin ? onNeedProducts : undefined}
      />
    )
  }

  const editingPast = targetWeek !== weekId
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
    const report: WeeklyReport = {
      week: targetWeek,
      productId: product.id,
      productName: product.name,
      author: actingName,
      progress: Math.min(100, Math.max(0, Number(progress) || 0)),
      lastWeek: lastWeek.trim(),
      nextWeek: nextWeek.trim(),
      updatedAt: new Date().toISOString(),
    }
    if (demo) {
      saveDemoReport(report)
      setHasExisting(true)
      if (report.progress >= 100) {
        onOk('全部完成')
      } else {
        onOk(hasExisting ? '已保存修改' : '演示模式：已保存')
      }
      return
    }
    onBusy(true)
    try {
      const path = reportPath(actingName, targetWeek)
      const existing = await getFile(
        settings.provider,
        settings.owner,
        settings.repo,
        path,
        settings.token,
      )
      await putFile(
        settings.provider,
        settings.owner,
        settings.repo,
        path,
        settings.token,
        `weekly: ${actingName} ${targetWeek} ${report.progress}%`,
        JSON.stringify(report, null, 2) + '\n',
        existing?.sha,
      )
      setHasExisting(true)
      onOk(
        report.progress >= 100
          ? '全部完成'
          : existing
            ? '已更新到 Gitee'
            : '已提交到 Gitee',
      )
    } catch (e) {
      onError(e)
    } finally {
      onBusy(false)
    }
  }

  return (
    <section className="card-block">
      <div className="row-between submit-head">
        <h1>{hasExisting ? '编辑周报' : '提交周报'}</h1>
        {!!productId && (
          <DeadlineCountdown
            inline
            deadline={products.find((p) => p.id === productId)?.deadline}
          />
        )}
      </div>
      <p className="hint">
        {weekLabel(targetWeek)}
        {editingPast ? ' · 改历史' : ' · 本周'}
        {' · '}
        {actingName || '未命名'}
      </p>

      {editingPast && (
        <button
          type="button"
          className="ghost"
          style={{ marginBottom: 12 }}
          onClick={() => onEditWeekChange(null)}
        >
          回到本周
        </button>
      )}

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
        {hasExisting
          ? demo
            ? '保存修改'
            : '更新到 Gitee'
          : demo
            ? '演示提交'
            : '提交到 Gitee'}
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
  hideRefresh = false,
  members,
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
  hideRefresh?: boolean
  members: string[]
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
        desc="先配置仓库"
        action="去设置"
        onAction={onNeedSettings}
      />
    )
  }

  const save = async (next: Product[]) => {
    const normalized = next.map((p) => normalizeProduct(p))
    if (demo) {
      onChangeProducts(normalized)
      saveDemoProducts(normalized)
      onOk('演示模式：分配已保存到本机')
      return
    }
    onBusy(true)
    try {
      const payload: ProductsFile = { products: normalized }
      await putFile(
        settings.provider,
        settings.owner,
        settings.repo,
        productsPath(),
        settings.token,
        `products: update (${normalized.length})`,
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
      onChangeProducts(normalized)
      onChangeSha(file?.sha)
      onOk('产品与分配已更新')
    } catch (e) {
      onError(e)
    } finally {
      onBusy(false)
    }
  }

  const add = () => {
    const n = name.trim()
    if (!n) return
    const today = new Date()
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    void save([
      ...products,
      { id: uid(), name: n, assignees: [], deadline: addMonths(iso, 1) },
    ])
    setName('')
  }

  const remove = (id: string) => {
    void save(products.filter((p) => p.id !== id))
  }

  const setDeadline = (productId: string, deadline: string) => {
    void save(
      products.map((p) =>
        p.id === productId
          ? { ...p, deadline: deadline || undefined }
          : p,
      ),
    )
  }

  const toggleAssignee = (productId: string, member: string) => {
    const next = products.map((p) => {
      if (p.id !== productId) return p
      const has = (p.assignees || []).includes(member)
      return {
        ...p,
        assignees: has
          ? (p.assignees || []).filter((m) => m !== member)
          : [...(p.assignees || []), member],
      }
    })
    void save(next)
  }

  return (
    <section className="card-block">
      <div className="row-between">
        <h1>产品与分配</h1>
        {!hideRefresh && (
          <button type="button" className="ghost slim" onClick={onRefresh} disabled={loading}>
            刷新
          </button>
        )}
      </div>
      <p className="hint">
        勾选成员后对方才能看到该产品；一人可多产品。截止日：鱼鱼一个月、千面两个月（可改）
      </p>

      {!products.length && (
        <button
          type="button"
          className="primary"
          style={{ marginBottom: 14 }}
          onClick={() => void save(SEED_PRODUCTS)}
        >
          一键写入：鱼鱼→cc（1个月）、千面→番茄（2个月）
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

      <ul className="product-list product-assign-list">
        {products.map((p) => (
          <li key={p.id}>
            <div className="product-assign-row">
              <div className="product-meta">
                <span>{p.name}</span>
                <small>
                  {(p.assignees || []).length
                    ? `已分配：${(p.assignees || []).join('、')}`
                    : '尚未分配成员'}
                </small>
                <DeadlineCountdown deadline={p.deadline} compact />
              </div>
              <button type="button" className="ghost danger" onClick={() => remove(p.id)}>
                删除
              </button>
            </div>
            <label className="deadline-field">
              <span>截止日</span>
              <input
                type="date"
                value={p.deadline || ''}
                onChange={(e) => setDeadline(p.id, e.target.value)}
              />
            </label>
            <div className="assignee-chips">
              {members.map((m) => {
                const on = (p.assignees || []).includes(m)
                return (
                  <button
                    key={m}
                    type="button"
                    className={`assignee-chip${on ? ' is-on' : ''}`}
                    onClick={() => toggleAssignee(p.id, m)}
                  >
                    {m}
                  </button>
                )
              })}
            </div>
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

      <Select
        label="身份"
        value={form.role}
        options={[
          { value: 'member', label: '成员' },
          { value: 'admin', label: '管理员' },
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
  action?: string
  onAction?: () => void
  secondary?: string
  onSecondary?: () => void
}) {
  return (
    <section className="empty">
      <h1>{title}</h1>
      <p>{desc}</p>
      {action && onAction && (
        <button type="button" className="primary" onClick={onAction}>
          {action}
        </button>
      )}
      {secondary && onSecondary && (
        <button type="button" className="ghost" style={{ marginTop: 10, width: '100%' }} onClick={onSecondary}>
          {secondary}
        </button>
      )}
    </section>
  )
}
