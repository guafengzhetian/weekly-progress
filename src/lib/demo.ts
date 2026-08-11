import { currentWeekId } from './week'
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

export function demoBoardReports(weekId: string): WeeklyReport[] {
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
