# 周报进度（Gitee）

成员提交进度、查看自己的历史；**管理员看全员看板、管产品**。

## 隐私：两个仓库

| 仓库 | 可见性 | 用途 |
|------|--------|------|
| [`weekly-progress`](https://gitee.com/space-invincible-hair/weekly-progress) | 可公开 | 只挂网页（Gitee Pages），**不写进度** |
| `weekly-progress-data`（需新建） | **必须私有** | 存 `products.json`、`reports/`，只有团队能看 |

App「设置」里填的是**私有数据仓**。外人打开 Pages 链接也看不到进度内容。

## 角色

| 身份 | 能做什么 |
|------|----------|
| **成员** | 提交本周进度、看自己的历史 |
| **管理员** | 进度看板（全员）、管产品、也可提交 |

## 你要做的

1. 在 Gitee 新建**私有**仓库：`weekly-progress-data`（空仓即可）  
2. 把两名成员加成该仓协作成员  
3. 生成私人令牌（勾选 projects）  
4. 打开网页 → 设置：身份、owner、`weekly-progress-data`、Token、显示名 → 测试连接 → 保存  

## 本地预览

```bash
npm install
npm run dev -- --host
# 演示：http://localhost:5173/?demo=1
```

## 发布网页（Pages）

```bash
npm run deploy:gitee
```

然后在公开仓 → **服务 → Gitee Pages**，选 `gh-pages` 分支。  
进度仍然只进私有仓 `weekly-progress-data`。
