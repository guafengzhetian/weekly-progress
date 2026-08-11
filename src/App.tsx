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
import {
  currentWeekId,
  productsPath,
  reportPath,
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
      { id: 'board', label: '看板' },
      { id: 'submit', label: '提交' },
      { id: 'products', label: '产品' },
      { id: 'settings', label: '设置' },
    ]
  }
  return [
    { id: 'submit', label: '提交' },
    { id: 'history', label: '我的' },
    { id: 'settings', label: '设置' },
  ]
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [demo, setDemo] = useState(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1') {
      return true
    }
    return loadDemo()
  })
  const [tab, setTab] = useState<Tab>(() =>
    loadSettings().role === 'admin' || loadDemo() ? 'board' : 'submit',
  )
  const [products, setProducts] = useState<Product[]>([])
  const [productsSha, setProductsSha] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const weekId = useMemo(() => currentWeekId(), [])
  const ready = demo || settingsReady(settings)
  const role: UserRole = demo ? 'admin' : settings.role
  const items = navItems(role)

  useEffect(() => {
    if (!items.some((i) => i.id === tab)) {
      setTab(items[0].id)
    }
  }, [items, tab])

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
    <div className="app">
      <header className="top">
        <div>
          <p className="brand">周报进度</p>
          <p className="sub">
            {weekLabel(weekId)}
            {demo ? ' · 演示' : role === 'admin' ? ' · 管理员' : ' · 成员'}
          </p>
        </div>
        {ready ? (
          <span className="pill">{demo ? '演示账号' : settings.displayName}</span>
        ) : (
          <button type="button" className="pill warn" onClick={() => setTab('settings')}>
            先配置
          </button>
        )}
      </header>

      {demo && (
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
            products={products}
            weekId={weekId}
            ready={ready}
            demo={demo}
            isAdmin={role === 'admin'}
            onNeedSettings={() => setTab('settings')}
            onNeedProducts={() => setTab(role === 'admin' ? 'products' : 'settings')}
            onBusy={setLoading}
            onError={showError}
            onOk={showToast}
          />
        )}
        {tab === 'history' && (
          <HistoryPanel
            settings={settings}
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
      const dirs = await listDir(
        settings.provider,
        settings.owner,
        settings.repo,
        'reports',
        settings.token,
      )
      const ids = dirs
        .filter((d) => d.type === 'dir')
        .map((d) => d.name)
        .sort()
        .reverse()
      setWeeks(ids.length ? ids : [weekId])
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
            path: reportPath(report.week, report.author),
            author: report.author,
            report,
          })),
        )
        setLoaded(true)
        return
      }
      const dir = `reports/${selected}`
      const files = await listDir(
        settings.provider,
        settings.owner,
        settings.repo,
        dir,
        settings.token,
      )
      const jsonFiles = files.filter((f) => f.type === 'file' && f.name.endsWith('.json'))
      const next: ReportListItem[] = []
      for (const f of jsonFiles) {
        try {
          const file = await getFile(
            settings.provider,
            settings.owner,
            settings.repo,
            f.path,
            settings.token,
          )
          if (!file) continue
          const report = JSON.parse(file.content) as WeeklyReport
          next.push({ path: f.path, author: report.author || f.name, report })
        } catch (e) {
          next.push({
            path: f.path,
            author: f.name,
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
    <section className="card-block">
      <div className="row-between">
        <h1>进度看板</h1>
        <button type="button" className="ghost" onClick={() => void load()}>
          刷新
        </button>
      </div>
      <p className="hint">仅管理员可见全员提交</p>

      <label className="field">
        <span>周次</span>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {weeks.map((w) => (
            <option key={w} value={w}>
              {weekLabel(w)}
              {w === weekId ? '（本周）' : ''}
            </option>
          ))}
        </select>
      </label>

      <div className="stats">
        <div>
          <strong>{valid.length}</strong>
          <span>已提交</span>
        </div>
        <div>
          <strong>{avg}%</strong>
          <span>平均进度</span>
        </div>
      </div>

      {loaded && items.length === 0 && (
        <p className="empty-text">这周还没人交。</p>
      )}

      <ul className="report-list">
        {items.map((item) => (
          <li key={item.path}>
            {item.report ? (
              <ReportCard report={item.report} />
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
  weekId,
  ready,
  demo,
  onNeedSettings,
  onBusy,
  onError,
}: {
  settings: Settings
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
        setItems(demoMyHistory(settings.displayName || '演示成员'))
        setLoaded(true)
        return
      }
      const dirs = await listDir(
        settings.provider,
        settings.owner,
        settings.repo,
        'reports',
        settings.token,
      )
      const weekDirs = dirs
        .filter((d) => d.type === 'dir')
        .map((d) => d.name)
        .sort()
        .reverse()
      const next: WeeklyReport[] = []
      for (const w of weekDirs) {
        const path = reportPath(w, settings.displayName)
        const file = await getFile(
          settings.provider,
          settings.owner,
          settings.repo,
          path,
          settings.token,
        )
        if (!file) continue
        next.push(JSON.parse(file.content) as WeeklyReport)
      }
      setItems(next)
      setLoaded(true)
    } catch (e) {
      onError(e)
    } finally {
      onBusy(false)
    }
  }, [ready, demo, settings, onBusy, onError])

  useEffect(() => {
    void load()
  }, [load])

  if (!ready) {
    return (
      <Empty
        title="我的历史"
        desc="配置后只能看到你自己交过的周报。"
        action="去设置"
        onAction={onNeedSettings}
      />
    )
  }

  return (
    <section className="card-block">
      <div className="row-between">
        <h1>我的历史</h1>
        <button type="button" className="ghost" onClick={() => void load()}>
          刷新
        </button>
      </div>
      <p className="hint">只显示 {settings.displayName || '你'} 的提交</p>

      {loaded && items.length === 0 && (
        <p className="empty-text">还没有历史记录，先去提交本周进度。</p>
      )}

      <ul className="report-list">
        {items.map((report) => (
          <li key={`${report.week}-${report.author}`}>
            <p className="meta">
              {weekLabel(report.week)}
              {report.week === weekId ? ' · 本周' : ''}
            </p>
            <ReportCard report={report} hideAuthor />
          </li>
        ))}
      </ul>
    </section>
  )
}

function ReportCard({
  report,
  hideAuthor,
}: {
  report: WeeklyReport
  hideAuthor?: boolean
}) {
  return (
    <>
      <div className="report-head">
        <strong>{hideAuthor ? report.productName : report.author}</strong>
        <span>{report.progress}%</span>
      </div>
      {!hideAuthor && <p className="meta">{report.productName}</p>}
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
    if (!ready || demo || !settings.displayName) return
    let cancelled = false
    ;(async () => {
      try {
        const path = reportPath(weekId, settings.displayName)
        const file = await getFile(
          settings.provider,
          settings.owner,
          settings.repo,
          path,
          settings.token,
        )
        if (!file || cancelled) return
        const report = JSON.parse(file.content) as WeeklyReport
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
  }, [ready, demo, settings, weekId])

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
      const path = reportPath(weekId, settings.displayName)
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
        author: settings.displayName,
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
        `weekly: ${settings.displayName} ${weekId} ${report.progress}%`,
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
      <h1>提交本周进度</h1>
      <p className="hint">写入 reports/{weekId}/</p>

      <label className="field">
        <span>产品</span>
        <select value={productId} onChange={(e) => setProductId(e.target.value)}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

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
      <p className="hint">仅管理员可改，成员提交时只能选择</p>

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
            <span>{p.name}</span>
            <button type="button" className="ghost danger" onClick={() => remove(p.id)}>
              删除
            </button>
          </li>
        ))}
        {!products.length && <li className="empty-text">还没有产品</li>}
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
      <p className="hint">Token 只存在本机浏览器。成员选「成员」，你选「管理员」。</p>

      <label className="field">
        <span>身份</span>
        <select
          value={form.role}
          onChange={(e) => set('role', e.target.value as UserRole)}
        >
          <option value="member">成员（提交 + 看自己历史）</option>
          <option value="admin">管理员（看板 + 管产品）</option>
        </select>
      </label>

      <label className="field">
        <span>Git 平台</span>
        <select
          value={form.provider}
          onChange={(e) => set('provider', e.target.value as Settings['provider'])}
        >
          <option value="gitee">Gitee</option>
          <option value="github">GitHub</option>
        </select>
      </label>

      <label className="field">
        <span>仓库主人（owner）</span>
        <input
          value={form.owner}
          onChange={(e) => set('owner', e.target.value)}
          placeholder="space-invincible-hair"
          autoCapitalize="off"
          autoCorrect="off"
        />
      </label>

      <label className="field">
        <span>仓库名（repo）</span>
        <input
          value={form.repo}
          onChange={(e) => set('repo', e.target.value)}
          placeholder="weekly-progress"
          autoCapitalize="off"
          autoCorrect="off"
        />
      </label>

      <label className="field">
        <span>私人令牌 Token</span>
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
        <li>本仓库可同时放网页和进度数据</li>
        <li>Gitee → 设置 → 私人令牌，勾选 projects</li>
        <li>你选管理员；他们选成员 + 各自名字</li>
        <li>手机浏览器「添加到主屏幕」</li>
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
