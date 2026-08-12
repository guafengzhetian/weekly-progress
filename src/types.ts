export type GitProvider = 'github' | 'gitee'
export type UserRole = 'member' | 'admin'

export interface Settings {
  provider: GitProvider
  owner: string
  repo: string
  token: string
  displayName: string
  role: UserRole
}

export interface Product {
  id: string
  name: string
  /** 管理员分配的可见成员（显示名） */
  assignees: string[]
  /** 截止日期 YYYY-MM-DD */
  deadline?: string
}

export interface ProductsFile {
  products: Product[]
}

export interface WeeklyReport {
  week: string
  productId: string
  productName: string
  author: string
  progress: number
  /** 本周期工时消耗（小时） */
  hours?: number
  lastWeek: string
  nextWeek: string
  updatedAt: string
}

export interface ReportListItem {
  path: string
  author: string
  report: WeeklyReport | null
  error?: string
}
