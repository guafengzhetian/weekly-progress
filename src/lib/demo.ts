import { currentWeekId, weekEndUtc } from './week'
import type { Product, WeeklyReport } from '../types'

export const DEMO_PRODUCTS: Product[] = [
  {
    id: 'yuyu-bye',
    name: '鱼鱼拜拜拜',
    ownerHint: 'cc · 微信小游戏后期收束',
  },
  {
    id: 'qianmian',
    name: '千面',
    ownerHint: '番茄 · 软件原型设计',
  },
]

function weeksBack(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n * 7)
  return currentWeekId(d)
}

function demoKey(author: string, week: string): string {
  return `${author}::${week}`
}

/** 演示模式本机编辑缓存（刷新页面会丢） */
const demoEdits = new Map<string, WeeklyReport>()

export function getDemoReport(
  author: string,
  weekId: string,
): WeeklyReport | undefined {
  const key = demoKey(author, weekId)
  const edited = demoEdits.get(key)
  if (edited) return edited
  return demoMyHistory(author).find((r) => r.week === weekId)
}

export function saveDemoReport(report: WeeklyReport): void {
  demoEdits.set(demoKey(report.author, report.week), report)
}

export function demoBoardReports(weekId: string): WeeklyReport[] {
  const base: WeeklyReport[] = [
    {
      week: weekId,
      productId: 'yuyu-bye',
      productName: '鱼鱼拜拜拜',
      author: 'cc',
      progress: 100,
      lastWeek: '推进小游戏后期收束：关卡与结算流程',
      nextWeek: '提审与收尾',
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
  return base.map((r) => demoEdits.get(demoKey(r.author, r.week)) ?? r)
}

export function demoMyHistory(author: string): WeeklyReport[] {
  const name = author || '演示成员'
  const product =
    name === '番茄'
      ? { id: 'qianmian', name: '千面' }
      : { id: 'yuyu-bye', name: '鱼鱼拜拜拜' }
  const seed: WeeklyReport[] = [0, 1, 2].map((i) => {
    const week = weeksBack(i)
    const end = weekEndUtc(week)
    const updated = new Date(end.getTime() + (i === 2 ? 15 : 2) * 86400000)
    return {
      week,
      productId: product.id,
      productName: product.name,
      author: name,
      progress: i === 0 ? 100 : 70 - i * 15,
      lastWeek: i === 0 ? '本周：推进收尾与联调' : `第 ${i} 周前：按计划推进`,
      nextWeek: i === 0 ? '下周：提测与修问题' : '继续迭代',
      updatedAt: updated.toISOString(),
    }
  })
  return seed.map((r) => demoEdits.get(demoKey(r.author, r.week)) ?? r)
}
