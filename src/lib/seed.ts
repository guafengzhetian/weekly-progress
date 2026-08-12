import type { Product } from '../types'

/** 管理员首次可一键写入私有仓的产品清单（不绑定具体成员） */
export const SEED_PRODUCTS: Product[] = [
  { id: 'yuyu-bye', name: '鱼鱼拜拜拜' },
  { id: 'qianmian', name: '千面' },
]
