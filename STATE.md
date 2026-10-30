# 博客状态

updated: 2026-10-30 · code: `08a0bba`（最后一次改动站点代码/配置的提交）
> 判据：`git log -1 -- admin tools scripts source _config.yml _config.butterfly.yml`
> 工作区干净；`master` 与 `origin/master` 同步，三次 push 的 CI 均 success。

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
  **歌曲页 `/songs/`**、说说、关于、友链、标签、分类、**站内视频（`source/videos/`）**
- 字体：全站 **JetBrains Maple Mono**（子集化分片自托管：`tools/build-fonts.py` →
  `source/fonts/JetBrainsMapleMono/` + `source/css/fonts.css`），首屏只下 latin + han-site ≈ 362 KB
- 正文：**16px**（`custom.css` 十三节，只放大 `#article-container`；代码块钉回 14px）。
  **别去改 `font.global_font_size`** —— 那是全站 em 的基准，一改侧栏/三栏首页全跟着动
- 图片 / 视频：md 正文写相对路径 `../images/xxx`、`../videos/xxx`（`scripts/img-path.js`
  渲染时转 `/images/xxx`、`/videos/xxx`）；front-matter 的 `cover` / `avatar` 必须写绝对 `/images/xxx`
- 本地管理页：`pnpm admin` → `http://127.0.0.1:5173`（文章 / 说说 / 歌单 / 图片 / 字体，
  顶栏区分 未保存 / 已保存未发布 / 已同步，可发布）。单张图片上限 **17 MB** ——
  `server.js` 的 `MAX_BODY_CHARS`（24 MB 字符 ≈ 17 MB 文件）与 `content.js` 的 `MAX_IMAGE_BYTES`
  **必须一起改**，只改一边不生效
- 最近完成（10-30，`08a0bba`）：首屏提速（灯箱换本地文件 + 站点脚本 `defer` +
  `/feed.json`/`/site.json` 在 `<head>` 预取 `window.__homeData` + `home-pending` 期间画骨架；
  三栏出现 462→221ms）+ 正文字号 14→16px
- 最近完成（10-30，`44ce260`/`29e9f9f`）：站内视频支持（`img-path.js` 改写
  `<video|audio|source src>` / `poster` / `[下载](../videos/x)`；**单文件 ≤ 25 MiB**，
  超了 CF Workers 整包部署失败；文件名不能以 `_` 开头）+ 上传上限 15→17 MB + favicon 改 `.ico`
- 最近完成（10-29，`2825680`）：全站字体换 JetBrains Maple Mono + 管理页「字体」视图
  （分片状态 / 缺字检测 / 一键重建）+ 文章重命名 + 站点改名「呜云的博客」
  （`my-dot.md` 已改名 `devices.md`，文章 URL 随之变为 `/2026/10/25/devices/`）
- 更早：正文多图并排、歌曲页、管理页图片管理（删除→回收站 / 重命名 / 点图复制引用），细节看 git log

## 下一步

1. 文档已补到 10-30（视频 / 首屏提速 / 正文字号，见 `docs/agent/01-配色与样式.md`），
   后续改动继续同步 `docs/agent/`；`docs/agent/02` 还缺「17 MB 上限成对改」和「站内视频投稿规矩」
2. 图片管理可选项（**暂缓，不做也能用**）：重命名用 `window.prompt`，可改卡片内联输入（非必须）
3. 歌曲页目前只展示列表，没做播放器；侧栏歌词卡仍是「无声按时间轴滚动」
4. 网易云接口（搜索 / 歌词 / 翻译）是外部依赖，失效时管理页会提示手动粘贴；
   真挂了就退回手动维护 `lyrics.yml` + `source/lrc/*.lrc`
5. `source/videos/VID_20261030111335804.mp4` 是 17.4 MiB，已进 git（历史里永久留着）；
   要不要压小 / 改外链 **还没定**，别默认重做

## 待验证

```bash
pnpm exec hexo generate        # 必须成功（改过 _config / scripts 先 pnpm exec hexo clean）
                               # ✅ 2026-10-30 通过（157 files）
pnpm admin                     # ⚠️ 10-30 改了 server.js/content.js（17 MB 上限）后未重跑
                               # 上次 ✅ 2026-10-29：字体视图 / 缺字检测 / 重建 / 文章重命名
python tools/build-fonts.py    # 新增生僻字后重跑  # 10-30 未跑（没动字体）
bash scripts/sync.sh --check '#78818a'   # 旧色值残留（改了样式没生效时用）
                               # 10-30 未跑：只加字号/骨架，没动配色变量值
gh run list --limit 3          # ✅ 2026-10-30：三次 push 均 success
curl -sI https://nitsugaoo.github.io/js/vendor/fancybox.umd.min.js
                               # ✅ 2026-10-30：200（107599B），灯箱本地文件已上线
```

⚠️ 改完 `_config*.yml` / `scripts/` 必须 `bash scripts/sync.sh --restart` —— `hexo server` 有渲染缓存，
不重启会继续返回旧页面（改站点 title 时踩过）。

⚠️ 首页首屏的三处改动是一对：`<head>` 的 `window.__homeData` 预取、`inject.bottom` 的 `defer`、
`.home-pending` 骨架。删掉预取不会坏（`home.js` 会自己 fetch），但会退回慢路径。

⚠️ 灯箱换版本要**同时**换 `source/js/vendor/fancybox.umd.min.js` 和 `source/css/fancybox.css`
（版本号 6.1.14，对应 `themes/butterfly/plugins.yml`），只换一个会样式/行为错位。

## 入口

| 项 | 位置 |
|---|---|
| 仓库 / 远端 | `~/blog` → `NitsugaoO/NitsugaoO.github.io`（**仓库名不能改**，否则发布路径变成子目录） |
| 配色权威 | `~/Themes/themes/everforest/tokens.yaml`（本仓库只是应用方） |
| 自定义样式 | `source/css/everforest.css`（配色）、`source/css/custom.css`（非配色；5.5 节=首页骨架、十三节=正文字号） |
| 网页字体 | `tools/build-fonts.py` → `source/fonts/JetBrainsMapleMono/`、`source/css/fonts.css` |
| 媒体路径改写 | `scripts/img-path.js`（`../images/`、`../videos/` → 站点绝对路径；跳过代码块 / `{% raw %}` / 行内代码） |
| 站内视频 | `source/videos/`（原样复制到 `/videos/`）；**单文件 ≤ 25 MiB**，文件名不能以 `_` 开头 |
| 灯箱（本地） | `source/js/vendor/fancybox.umd.min.js` + `source/css/fancybox.css` |
| 自定义行为 | `source/js/custom.js`、`source/js/home.js`、`source/js/library.js`、`source/js/songs.js` |
| 本地管理页 | `admin/`（`server.js` 后端、`content.js` 数据、`fonts.js` 字体、`public/app.js` 前端） |
| 站点脚本（要重启） | `scripts/*.js`（library-data / site-data / updated-from-git / custom-codeblock） |
| 数据文件 | `source/_data/{lyrics,shuoshuo,site,link}.yml` |
| 辅助脚本 | `scripts/sync.sh`（发布 / 重启预览 / 查色值残留） |
| 部署 | `.github/workflows/pages.yml`、`wrangler.jsonc`（CF，需 `NODE_VERSION=22`） |
