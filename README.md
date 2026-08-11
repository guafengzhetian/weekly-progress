# 周报进度（Gitee）

两人小组手机网页：成员提交进度、查看自己的历史；**管理员看全员看板、管产品**。数据写入 Gitee，不租服务器。

## 角色

| 身份 | 能做什么 |
|------|----------|
| **成员** | 提交本周进度、看自己的历史 |
| **管理员** | 进度看板（全员）、管产品、也可提交 |

设置里选身份即可。成员看不到别人的周报。

## 仓库

已对接：`https://gitee.com/space-invincible-hair/weekly-progress.git`  
同一仓库可放网页 + `products.json` / `reports/` 数据。

## 本地预览

```bash
npm install
npm run dev -- --host
# 演示模式（无需 Token）：
# http://localhost:5173/?demo=1
```

## 发布到 Gitee Pages

```bash
npm run deploy:gitee
```

然后在 Gitee 仓库 → **服务 → Gitee Pages**，选 `gh-pages` 分支部署。手机打开生成的链接即可（不在一地也能用）。

## 成员怎么配

1. 打开网页 → 设置  
2. 身份选「成员」，填 owner / repo / 私人令牌 / 自己的显示名  
3. 提交周报；「我的」里只看自己的历史  

管理员同样操作，身份选「管理员」，即可进看板。
