# 周报进度（Gitee）

成员提交进度、查看自己的历史；**管理员看全员看板、管产品**。

## 隐私：两个仓库

| 仓库 | 可见性 | 用途 |
|------|--------|------|
| [`weekly-progress`](https://gitee.com/space-invincible-hair/weekly-progress) | 可公开 | 只挂网页（Gitee Pages），**不写进度** |
| [`private-database`](https://gitee.com/space-invincible-hair/private-database) | **私有** | 每人独立目录存周报，只有团队能看 |

### 数据隔离

```text
products.json                 # 共享产品列表（管理员维护）
users/
  小张/
    reports/
      2026-W33.json           # 只属于小张
  小李/
    reports/
      2026-W33.json           # 只属于小李
```

- **成员**：界面只读自己的 `users/自己的名字/`，互相看不到对方周报  
- **管理员**：看板汇总所有人目录，电脑端查看  

App「设置」里填的是私有仓 `private-database`。外人打开 Pages 链接也看不到进度内容。

## 角色

| 身份 | 能做什么 |
|------|----------|
| **成员** | 提交本周进度、看自己的历史 |
| **管理员** | 进度看板（全员）、管产品、也可提交 |

## 你要做的

1. 确认 `private-database` 是**私有**仓库  
2. 把两名成员加成该仓协作成员  
3. 生成私人令牌（勾选 projects）  
4. 打开网页 → 设置：身份、owner、`private-database`、Token、显示名 → 测试连接 → 保存  

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
进度仍然只进私有仓 `private-database`。
