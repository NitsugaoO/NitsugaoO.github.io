# 博客状态

updated: 2026-10-23 · code: `93c904e`（最后一次改动站点代码/配置的提交）

> 本文件只放**会过期**的事实：阶段 / 下一步 / 待验证 / 入口。
> 开工规矩见 [`AGENTS.md`](AGENTS.md)，配色/样式见 [`docs/agent/01-配色与样式.md`](docs/agent/01-配色与样式.md)，
> 内容与管理页见 [`docs/agent/02-内容与数据.md`](docs/agent/02-内容与数据.md)，
> 构建发布见 [`docs/agent/03-构建与发布.md`](docs/agent/03-构建与发布.md)。
>
> **每次会话收尾只需要改这一个文件的三节**，并更新首行。

## 阶段

- 技术栈：**Hexo 8 + Butterfly 5.7 + Everforest（hard 暗色）**；分支 `master`
- 部署：**GitHub Pages**（`nitsugao.github.io`）+ **Cloudflare Workers**（`blog.wooyun.workers.dev`），
  push 后自动构建
- 页面结构：首页三栏（`source/js/home.js` 接管，数据来自 `/feed.json`）、文章库（`/library.json`）、
  **歌曲页 `/songs/`**、说说、关于、友链、标签、分类
- 内容与数据：文章 `source/_posts/`、歌单 `source/_data/lyrics.yml` + `source/lrc/*.lrc`、
  说说/站点/友链在 `source/_data/`
- 本地管理页：`pnpm admin` → `http://127.0.0.1:5173`（增删改文章/说说/歌单，可发布）
- 最近完成：歌曲页（`93c904e`：感想 / 添加时间 / 随机播放开关）+ 网易云搜索添加 + LRC 拉取

## 下一步

1. **先处理在途改动**：`git status` 里 `source/_data/lyrics.yml` 是未提交的用户改动，
   确认后再提交（别把用户正在编辑的内容一起打包）
2. 本次整理新增了 `AGENTS.md` / `STATE.md` / `docs/agent/*`（由原全局 skill 迁入），
   用了几天后如果发现分工不合适，调整这三处而不是再建新文档
3. 没有其它硬 backlog；新功能按 `docs/agent/` 的分工改，配色改动先看 `~/Themes` 的角色表

## 待验证

```bash
pnpm exec hexo generate        # 必须成功（改过 _config / scripts 先 pnpm exec hexo clean）
bash scripts/sync.sh --check '#78818a'   # 旧色值残留（改了样式没生效时用）
gh run list --limit 3          # 发布后看构建状态（GitHub Pages）
```

改完 `source/css/`、`_config*.yml` 必须重新生成；改过 `scripts/` 必须重启 `hexo server`。

## 入口

| 项 | 位置 |
|---|---|
| 仓库 / 远端 | `~/blog` → `NitsugaoO/NitsugaoO.github.io`（**仓库名不能改**，否则发布路径变成子目录） |
| 配色权威 | `~/Themes/themes/everforest/tokens.yaml`（本仓库只是应用方） |
| 自定义样式 | `source/css/everforest.css`（配色）、`source/css/custom.css`（非配色） |
| 自定义行为 | `source/js/custom.js`、`source/js/home.js`、`source/js/songs.js` |
| 站点脚本（要重启） | `scripts/*.js`（library-data / site-data / updated-from-git / custom-codeblock） |
| 数据文件 | `source/_data/{lyrics,shuoshuo,site,link}.yml` |
| 辅助脚本 | `scripts/sync.sh`（发布 / 重启预览 / 查色值残留） |
| 部署 | `.github/workflows/pages.yml`、`wrangler.jsonc`（CF，需 `NODE_VERSION=22`） |
