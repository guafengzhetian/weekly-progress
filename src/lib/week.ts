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

export function reportPath(weekId: string, displayName: string): string {
  return `reports/${weekId}/${safeFileName(displayName)}.json`
}

export function productsPath(): string {
  return 'products.json'
}
