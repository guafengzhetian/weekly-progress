#!/usr/bin/env bash
# 把网页发布到当前仓库的 gh-pages 分支，供 Gitee Pages 使用
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cp -R dist/. "$TMP/"
touch "$TMP/.nojekyll"

git worktree remove --force .gh-pages-tmp 2>/dev/null || true
rm -rf .gh-pages-tmp
git worktree add -B gh-pages .gh-pages-tmp

rm -rf .gh-pages-tmp/*
cp -R "$TMP"/. .gh-pages-tmp/
cd .gh-pages-tmp
git add -A
if git diff --cached --quiet; then
  echo "没有变更，跳过推送"
else
  git commit -m "deploy: $(date '+%Y-%m-%d %H:%M')"
  git push -u origin gh-pages
  echo "已推送到 gh-pages。请到 Gitee 仓库 → 服务 → Gitee Pages 部署该分支。"
fi

cd ..
git worktree remove --force .gh-pages-tmp
