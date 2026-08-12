import type { Product } from '../types'

/** 团队成员名单（管理员分配产品时勾选） */
export const TEAM_MEMBERS = ['cc', '番茄'] as const

/** 任务派发日（用于默认截止计算） */
export const TASK_ASSIGNED_ON = '2026-08-11'

/** 在 YYYY-MM-DD 上加整月，按日历月滚动 */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setMonth(dt.getMonth() + months)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** 管理员首次可一键写入私有仓的产品清单 */
export const SEED_PRODUCTS: Product[] = [
  {
    id: 'yuyu-bye',
    name: '鱼鱼拜拜拜',
    assignees: ['cc'],
    /** 派发日起一个月 */
    deadline: addMonths(TASK_ASSIGNED_ON, 1),
  },
  {
    id: 'qianmian',
    name: '千面',
    assignees: ['番茄'],
    /** 派发日起两个月 */
    deadline: addMonths(TASK_ASSIGNED_ON, 2),
  },
]

export function normalizeProduct(p: Partial<Product> & { id: string; name: string }): Product {
  const deadline =
    typeof p.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.deadline)
      ? p.deadline
      : undefined
  return {
    id: p.id,
    name: p.name,
    assignees: Array.isArray(p.assignees) ? p.assignees.filter(Boolean) : [],
    ...(deadline ? { deadline } : {}),
  }
}

export function productsForMember(products: Product[], memberName: string): Product[] {
  const name = memberName.trim()
  if (!name) return []
  return products.filter((p) => (p.assignees || []).includes(name))
}

export type DeadlineInfo = {
  deadline: string
  dateLabel: string
  daysLeft: number
  text: string
  overdue: boolean
  urgent: boolean
}

/** 按本地日历日计算倒计时 */
export function getDeadlineInfo(
  deadline?: string,
  now: Date = new Date(),
): DeadlineInfo | null {
  if (!deadline || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return null
  const [y, m, d] = deadline.split('-').map(Number)
  const endDay = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const daysLeft = Math.round((endDay.getTime() - today.getTime()) / 86400000)
  const dateLabel = endDay.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  let text: string
  if (daysLeft > 1) text = `还剩 ${daysLeft} 天`
  else if (daysLeft === 1) text = '还剩 1 天'
  else if (daysLeft === 0) text = '今天截止'
  else text = `已逾期 ${-daysLeft} 天`

  return {
    deadline,
    dateLabel,
    daysLeft,
    text,
    overdue: daysLeft < 0,
    urgent: daysLeft >= 0 && daysLeft <= 7,
  }
}
