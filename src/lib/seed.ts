import type { Product } from '../types'

/** 管理员首次可一键写入私有仓的产品清单 */
export const SEED_PRODUCTS: Product[] = [
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
