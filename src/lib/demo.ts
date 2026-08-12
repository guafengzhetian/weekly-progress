import { currentWeekId, weekEndUtc } from './week'
import { SEED_PRODUCTS, normalizeProduct } from './seed'
import type { Product, WeeklyReport } from '../types'

export const DEMO_PRODUCTS: Product[] = SEED_PRODUCTS.map((p) =>
  normalizeProduct({
    ...p,
    assignees: [...p.assignees],
  }),
)

function weeksBack(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n * 7)
  return currentWeekId(d)
}

const DEMO_STORE_KEY = 'weekly-progress-demo-reports'
const DEMO_PRODUCTS_KEY = 'weekly-progress-demo-products'

function readDemoStore(): Record<string, WeeklyReport> {
  try {
    const raw = localStorage.getItem(DEMO_STORE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, WeeklyReport>
  } catch {
    return {}
  }
}

function writeDemoStore(store: Record<string, WeeklyReport>) {
  localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store))
}

export function loadDemoProducts(): Product[] {
  try {
    const raw = localStorage.getItem(DEMO_PRODUCTS_KEY)
    if (!raw) return DEMO_PRODUCTS.map((p) => normalizeProduct(p))
    const list = JSON.parse(raw) as Product[]
    if (!Array.isArray(list)) return DEMO_PRODUCTS.map((p) => normalizeProduct(p))
    return list.map((p) => {
      const seed = DEMO_PRODUCTS.find((s) => s.id === p.id)
      return normalizeProduct({
        ...p,
        // 旧演示缓存没有截止日时，补上种子默认值
        deadline: p.deadline || seed?.deadline,
      })
    })
  } catch {
    return DEMO_PRODUCTS.map((p) => normalizeProduct(p))
  }
}

export function saveDemoProducts(products: Product[]) {
  localStorage.setItem(DEMO_PRODUCTS_KEY, JSON.stringify(products))
}

export function demoReportKey(author: string, week: string) {
  return `${author}::${week}`
}

export function getDemoReport(author: string, week: string): WeeklyReport | null {
  return readDemoStore()[demoReportKey(author, week)] || null
}

export function saveDemoReport(report: WeeklyReport) {
  const store = readDemoStore()
  store[demoReportKey(report.author, report.week)] = report
  writeDemoStore(store)
}

export function demoBoardReports(weekId: string): WeeklyReport[] {
  const store = readDemoStore()
  const fromStore = Object.values(store).filter((r) => r.week === weekId)
  if (fromStore.length) return fromStore

  return [
    {
      week: weekId,
      productId: 'yuyu-bye',
      productName: '鱼鱼拜拜拜',
      author: 'cc',
      progress: 65,
      lastWeek: '推进小游戏后期收束：关卡与结算流程',
      nextWeek: '继续收尾并准备提审材料',
      updatedAt: new Date().toISOString(),
    },
    {
      week: weekId,
      productId: 'qianmian',
      productName: '千面',
      author: '番茄',
      progress: 40,
      lastWeek: '千面软件原型：梳理核心流程与页面结构',
      nextWeek: '补关键交互稿与状态说明',
      updatedAt: new Date().toISOString(),
    },
  ]
}

/** 演示历史：按该成员被分配的产品生成 */
export function demoMyHistory(author: string, products?: Product[]): WeeklyReport[] {
  const name = author || 'cc'
  const store = readDemoStore()
  const fromStore = Object.values(store)
    .filter((r) => r.author === name)
    .sort((a, b) => b.week.localeCompare(a.week))
  if (fromStore.length) return fromStore

  const assigned = (products || DEMO_PRODUCTS).filter((p) =>
    (p.assignees || []).includes(name),
  )
  const list =
    assigned.length > 0
      ? assigned
      : [{ id: 'unassigned', name: '未分配产品', assignees: [] as string[] }]

  const base = [0, 1, 2].flatMap((i) => {
    const week = weeksBack(i)
    const end = weekEndUtc(week)
    const updated = new Date(end.getTime() + (i === 2 ? 15 : 2) * 86400000)
    return list.map((product, pi) => ({
      week,
      productId: product.id,
      productName: product.name,
      author: name,
      progress: Math.max(10, 70 - i * 15 - pi * 5),
      lastWeek:
        i === 0
          ? `本周推进「${product.name}」`
          : `第 ${i} 周前推进「${product.name}」`,
      nextWeek: i === 0 ? `继续「${product.name}」` : '继续迭代',
      updatedAt: updated.toISOString(),
    }))
  })
  return base.sort((a, b) => b.week.localeCompare(a.week))
}
