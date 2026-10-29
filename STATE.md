# 博客状态

updated: 2026-10-29 · code: `2825680`（最后一次改动站点代码/配置的提交，含 `admin/`、`tools/`、`source/fonts/`）
> 工作区有未提交改动：`source/_data/link.yml` 文案、新文章 `source/_posts/rice.md` + 4 张图。

> 本文件只放**会过期**的事实：阶段 / 下一步 / 待验证 / 入口。
> 开工规矩见 [`AGENTS.md`](AGENTS.md)，配色/样式见 [`docs/agent/01-配色与样式.md`](docs/agent/01-配色与样式.md)，
> 内容与管理页见 [`docs/agent/02-内容与数据.md`](docs/agent/02-内容与数据.md)，
> 构建发布见 [`docs/agent/03-构建与发布.md`](docs/agent/03-构建与发布.md)。
>
> **每次会话收尾只需要改这一个文件的三节**，并更新首行。

## 阶段

- 技术栈：**Hexo 8 + Butterfly 5.7 + Everforest（hard 暗色）**；分支 `master`；站点名 **呜云的博客**
- 部署：**GitHub Pages**（`nitsugaoo.github.io`）+ **Cloudflare Workers**（`blog.wooyun.workers.dev`），
  push 后自动构建
- 页面结构：首页三栏（`source/js/home.js` 接管，数据来自 `/feed.json`）、文章库（`/library.json`）、
  **歌曲页 `/songs/`**、说说、关于、友链、标签、分类
- 字体：全站 **JetBrains Maple Mono**（子集化分片自托管：`tools/build-fonts.py` →
  `source/fonts/JetBrainsMapleMono/` + `source/css/fonts.css`），首屏只下 latin + han-site ≈ 362 KB
- 图片：md 正文写相对路径 `../images/xxx`（`scripts/img-path.js` 渲染时转 `/images/xxx`）；
  front-matter 的 `cover` / `avatar` 必须写绝对 `/images/xxx`
- 本地管理页：`pnpm admin` → `http://127.0.0.1:5173`（文章 / 说说 / 歌单 / 图片 / 字体，
  顶栏区分 未保存 / 已保存未发布 / 已同步，可发布）
- 最近完成（10-29，`2825680`）：全站字体换 JetBrains Maple Mono + 管理页「字体」视图
  （分片状态 / 缺字检测 / 一键重建）+ 文章重命名 + 站点改名「呜云的博客」
  （`my-dot.md` 已改名 `devices.md`，文章 URL 随之变为 `/2026/10/25/devices/`）
- 最近完成（10-29，`adf0da6`）：正文多图并排（连续图行→两列、空行→单列）+ 全站图片引用相对化
- 更早：歌曲页、管理页图片管理（删除→回收站 / 重命名 / 点图复制引用），细节看 git log

## 下一步

1. 提交当前未提交的内容：`source/_data/link.yml`、新文章 `rice.md` + 4 张图
2. 文档已跟代码对齐（10-29 那次会话补完），后续改动记得同步 `docs/agent/`
3. 图片管理可选项（**暂缓，不做也能用**）：重命名用 `window.prompt`，可改卡片内联输入（非必须）
4. 歌曲页目前只展示列表，没做播放器；侧栏歌词卡仍是「无声按时间轴滚动」
5. 网易云接口（搜索 / 歌词 / 翻译）是外部依赖，失效时管理页会提示手动粘贴；
   真挂了就退回手动维护 `lyrics.yml` + `source/lrc/*.lrc`

## 待验证

```bash
pnpm exec hexo generate        # 必须成功（改过 _config / scripts 先 pnpm exec hexo clean）
                               # ✅ 2026-10-29 通过（139 files）
pnpm admin                     # ✅ 2026-10-29 已验：字体视图 / 缺字检测 / 重建 38 秒 / 文章重命名
python tools/build-fonts.py    # 新增生僻字后重跑 # ✅ 2026-10-29 通过（8 片 3.62 MB）
bash scripts/sync.sh --check '#78818a'   # 旧色值残留（改了样式没生效时用）
                               # 2026-10-29 未跑：这次没动配色变量
gh run list --limit 3          # ✅ 2026-10-29：两次 push 均 success
```

⚠️ 改完 `_config*.yml` / `scripts/` 必须 `bash scripts/sync.sh --restart` —— `hexo server` 有渲染缓存，
不重启会继续返回旧页面（改站点 title 时踩过）。

## 入口

| 项 | 位置 |
|---|---|
| 仓库 / 远端 | `~/blog` → `NitsugaoO/NitsugaoO.github.io`（**仓库名不能改**，否则发布路径变成子目录） |
| 配色权威 | `~/Themes/themes/everforest/tokens.yaml`（本仓库只是应用方） |
| 自定义样式 | `source/css/everforest.css`（配色）、`source/css/custom.css`（非配色） |
| 网页字体 | `tools/build-fonts.py` → `source/fonts/JetBrainsMapleMono/`、`source/css/fonts.css` |
| 图片路径改写 | `scripts/img-path.js`（`../images/` → `/images/`，跳过代码块 / `{% raw %}`） |
| 自定义行为 | `source/js/custom.js`、`source/js/home.js`、`source/js/library.js`、`source/js/songs.js` |
| 本地管理页 | `admin/`（`server.js` 后端、`content.js` 数据、`fonts.js` 字体、`public/app.js` 前端） |
| 站点脚本（要重启） | `scripts/*.js`（library-data / site-data / updated-from-git / custom-codeblock） |
| 数据文件 | `source/_data/{lyrics,shuoshuo,site,link}.yml` |
| 辅助脚本 | `scripts/sync.sh`（发布 / 重启预览 / 查色值残留） |
| 部署 | `.github/workflows/pages.yml`、`wrangler.jsonc`（CF，需 `NODE_VERSION=22`） |
