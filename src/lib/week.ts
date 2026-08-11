/** ISO week label like 2026-W33 */
export function currentWeekId(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function weekLabel(weekId: string): string {
  return weekId.replace('-W', ' 第') + ' 周'
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
