import type { Product } from '../types'

/** 团队成员名单（管理员分配产品时勾选） */
export const TEAM_MEMBERS = ['cc', '番茄'] as const

/** 管理员首次可一键写入私有仓的产品清单 */
export const SEED_PRODUCTS: Product[] = [
  { id: 'yuyu-bye', name: '鱼鱼拜拜拜', assignees: ['cc'] },
  { id: 'qianmian', name: '千面', assignees: ['番茄'] },
]

export function normalizeProduct(p: Partial<Product> & { id: string; name: string }): Product {
  return {
    id: p.id,
    name: p.name,
    assignees: Array.isArray(p.assignees) ? p.assignees.filter(Boolean) : [],
  }
}

export function productsForMember(products: Product[], memberName: string): Product[] {
  const name = memberName.trim()
  if (!name) return []
  return products.filter((p) => (p.assignees || []).includes(name))
}
