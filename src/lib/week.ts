/** ISO week label like 2026-W33 */
export function currentWeekId(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** 内部仍用 ISO weekId 存文件；界面不展示「第几周」 */
export function weekLabel(weekId: string): string {
  return periodLabel(weekId)
}

/** 约一周的日期区间，如 8/10–8/16 */
export function periodLabel(weekId: string): string {
  const start = weekStartUtc(weekId)
  const end = weekEndUtc(weekId)
  const fmt = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
  return `${fmt(start)}–${fmt(end)}`
}

export function shortDateLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

/** 上一 ISO 周 */
export function previousWeekId(weekId: string): string {
  const monday = weekStartUtc(weekId)
  monday.setUTCDate(monday.getUTCDate() - 7)
  return currentWeekId(monday)
}

/** ISO 周的周日 23:59:59.999 UTC */
export function weekEndUtc(weekId: string): Date {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekId)
  if (!match) return new Date()
  const year = Number(match[1])
  const week = Number(match[2])
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const mondayWeek1 = new Date(jan4)
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1))
  const monday = new Date(mondayWeek1)
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  sunday.setUTCHours(23, 59, 59, 999)
  return sunday
}

/** ISO 周的周一 00:00:00.000 UTC */
export function weekStartUtc(weekId: string): Date {
  const end = weekEndUtc(weekId)
  const monday = new Date(end)
  monday.setUTCDate(end.getUTCDate() - 6)
  monday.setUTCHours(0, 0, 0, 0)
  return monday
}

/** 周结束后再宽限 graceDays 天内提交算按时 */
export function isOnTime(
  weekId: string,
  updatedAt: string,
  graceDays = 10,
): boolean {
  const end = weekEndUtc(weekId)
  const deadline = new Date(end.getTime() + graceDays * 24 * 60 * 60 * 1000)
  const submitted = new Date(updatedAt)
  if (Number.isNaN(submitted.getTime())) return false
  return submitted.getTime() <= deadline.getTime()
}

export function onTimeLabel(
  weekId: string,
  updatedAt?: string,
  graceDays = 10,
): '按时' | '逾期' | '未交' {
  if (!updatedAt) return '未交'
  return isOnTime(weekId, updatedAt, graceDays) ? '按时' : '逾期'
}

export function safeFileName(name: string): string {
  return name
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 40) || 'anonymous'
}

/** 每人独立目录，互不混放 */
export function reportPath(displayName: string, weekId: string): string {
  return `users/${safeFileName(displayName)}/reports/${weekId}.json`
}

export function userReportsDir(displayName: string): string {
  return `users/${safeFileName(displayName)}/reports`
}

export function usersDir(): string {
  return 'users'
}

export function productsPath(): string {
  return 'products.json'
}
