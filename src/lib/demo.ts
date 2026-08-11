import { currentWeekId } from './week'
import type { Product, WeeklyReport } from '../types'

export const DEMO_PRODUCTS: Product[] = [
  { id: 'p-a', name: '产品 A' },
  { id: 'p-b', name: '产品 B' },
]

function weeksBack(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n * 7)
  return currentWeekId(d)
}

export function demoBoardReports(weekId: string): WeeklyReport[] {
  return [
    {
      week: weekId,
      productId: 'p-a',
      productName: '产品 A',
      author: '小张',
      progress: 65,
      lastWeek: '完成登录与权限联调',
      nextWeek: '做首页看板和埋点',
      updatedAt: new Date().toISOString(),
    },
    {
      week: weekId,
      productId: 'p-b',
      productName: '产品 B',
      author: '小李',
      progress: 40,
      lastWeek: '梳理接口文档，搭好列表页骨架',
      nextWeek: '补筛选条件和空状态',
      updatedAt: new Date().toISOString(),
    },
  ]
}

export function demoMyHistory(author: string): WeeklyReport[] {
  const name = author || '演示成员'
  return [0, 1, 2].map((i) => {
    const week = weeksBack(i)
    return {
      week,
      productId: 'p-a',
      productName: '产品 A',
      author: name,
      progress: 70 - i * 15,
      lastWeek: i === 0 ? '本周演示：完成模块联调' : `第 ${i} 周前：推进需求开发`,
      nextWeek: i === 0 ? '下周演示：提测并修 bug' : '继续迭代功能',
      updatedAt: new Date().toISOString(),
    }
  })
}
