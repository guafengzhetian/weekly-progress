import { currentWeekId, weekEndUtc } from './week'
import type { Product, WeeklyReport } from '../types'

export const DEMO_PRODUCTS: Product[] = [
  { id: 'yuyu-bye', name: '鱼鱼拜拜拜' },
  { id: 'qianmian', name: '千面' },
]

function weeksBack(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n * 7)
  return currentWeekId(d)
}

const DEMO_STORE_KEY = 'weekly-progress-demo-reports'

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

/** 演示历史：同一人可有多个产品的周报 */
export function demoMyHistory(author: string): WeeklyReport[] {
  const name = author || 'cc'
  const store = readDemoStore()
  const fromStore = Object.values(store)
    .filter((r) => r.author === name)
    .sort((a, b) => b.week.localeCompare(a.week))
  if (fromStore.length) return fromStore

  const base = [0, 1, 2].flatMap((i) => {
    const week = weeksBack(i)
    const end = weekEndUtc(week)
    const updated = new Date(end.getTime() + (i === 2 ? 15 : 2) * 86400000)
    // 每人两款产品，体现一人可做多个
    const products =
      name === '番茄'
        ? [
            { id: 'qianmian', name: '千面' },
            { id: 'yuyu-bye', name: '鱼鱼拜拜拜' },
          ]
        : [
            { id: 'yuyu-bye', name: '鱼鱼拜拜拜' },
            { id: 'qianmian', name: '千面' },
          ]
    return products.map((product, pi) => ({
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
