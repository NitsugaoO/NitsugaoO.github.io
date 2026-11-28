# 博客状态

updated: 2026-11-28 · code: `a9f3dba`（最后一次改动站点代码/配置的提交）
> 判据：`git log -1 -- admin tools scripts source/css source/js source/exercise source/wangan-cards _config.yml _config.butterfly.yml`
> （不含整个 `source`：只改文章/说说/图片的内容提交不算代码变动，早期判据会误报。
> `source/exercise` 在判据里，是因为它的 `data.js` 会随题库重新构建而变。）
> `master` 与 `origin/master` 是否同步，开工时自己看 `git status` / `git log`。

> 本文件只放**会过期**的事实：阶段 / 未完成 / 入口。
> 开工规矩、验证命令、「试过不行」清单见 [`AGENTS.md`](AGENTS.md)；配色/样式见 [`docs/agent/01-配色与样式.md`](docs/agent/01-配色与样式.md)，
> 内容与管理页见 [`docs/agent/02-内容与数据.md`](docs/agent/02-内容与数据.md)，
> 构建发布见 [`docs/agent/03-构建与发布.md`](docs/agent/03-构建与发布.md)。
>
> **每次会话收尾只需要改这一个文件的两节**，并更新首行。

## 阶段

- 技术栈：**Hexo 8 + Butterfly 5.7 + Everforest（hard 暗色）**；分支 `master`；站点名 **呜云的博客**
- 部署：**GitHub Pages**（`nitsugaoo.github.io`）+ **Cloudflare Workers**（`blog.wooyun.workers.dev`），
  push 后自动构建
- 页面结构：首页三栏（`source/js/home.js` 接管，数据来自 `/feed.json`）、文章库（`/library.json`）、
  **歌曲页 `/songs/`**、说说、关于、友链、标签、分类、**站内视频（`source/videos/`）**、
  **两个独立静态页 `/exercise/` `/wangan-cards/`**（不进 Hexo 渲染，`_config.yml` 的 `skip_render` 原样复制）
- 字体：全站 **JetBrains Maple Mono**（子集化分片自托管：`tools/build-fonts.py` →
  `source/fonts/JetBrainsMapleMono/` + `source/css/fonts.css`），首屏只下 latin + han-site ≈ 362 KB
- 正文：**16px**（`custom.css` 十三节，只放大 `#article-container`；代码块钉回 14px）。
  **别去改 `font.global_font_size`** —— 那是全站 em 的基准，一改侧栏/三栏首页全跟着动
- 图片 / 视频：md 正文写相对路径 `../images/xxx`、`../videos/xxx`（`scripts/img-path.js`
  渲染时转 `/images/xxx`、`/videos/xxx`）；front-matter 的 `cover` / `avatar` 必须写绝对 `/images/xxx`
- **列表图片一律走缩略图**：`tools/make-thumbs.py` → `source/images/thumbs/*.webp`
  （长边 1000 / q82；现在 59 张 / 3.1 MB）。原图是手机原图（最大 6144×8192 / 17 MB），
  一条 9 张图的说说 61 MB → 首页现在 ≈ 1.4 MB。灯箱点开仍是原图
- **图片组按张数分档**：1 张完整显示 / 2 张两列 / 3 张三列 / 4 张 2×2 / 5 张以上九宫格
  （见 `custom.css` 第十一节）。`:has()` 数张数那套已删，改成渲染期加 `.ph-imgs--N` class
- 本地管理页：`pnpm admin` → `http://127.0.0.1:5173`（文章 / 说说 / 歌单 / 图片 / 字体，
  顶栏区分 未保存 / 已保存未发布 / 已同步，可发布）。单张图片上限 **17 MB** ——
  `server.js` 的 `MAX_BODY_CHARS`（24 MB 字符 ≈ 17 MB 文件）与 `content.js` 的 `MAX_IMAGE_BYTES`
  **必须一起改**，只改一边不生效
- 最近完成（11-28）：**管理页「发布」能推「已提交未推送」了** —— 原来 `/api/publish` 在工作区干净
  但 `ahead > 0` 时直接返回 ok，push 永远走不到（状态卡在「已保存 · 未发布（1 个提交）」）；
  现在无暂存改动也会 push，前端按 `pushed` 区分提示（不再假报「已推送」）
- 最近完成（11-24）：两个**独立静态页**——课程作品性质，不是博客正文
  - `/exercise/` 数分 159 题交互练习（数分 83 / 线代 76，含 19 道找错）+ 35 张技巧卡；
    产物在 `source/exercise/`（`data.js` 6 MB，构建期预渲染好的 KaTeX HTML，**别手改**），
    源码工程是 `~/Desktop/数学相关作业/quiz-build`（`node build.mjs --out <目录>`）。
    **期末可能整体下线**：`git rm -r source/exercise` + 删 `skip_render` 那行
  - `/wangan-cards/` 网安期中记忆卡：单文件 `source/wangan-cards/index.html`（内联 CSS/JS，无框架），
    121 张卡 / 7 讲 / 5 类；间隔重复（答对 2 次归档「已掌握」）+ 多存档 + GitHub Gist 云同步（`wgs1:` 同步码）；
    进度存 localStorage（`wangan-cards-v2` / `wangan-sync-v1`）。**这块打算长期留着继续完善**
- 最近完成（11-10）：**壁纸 + 亚克力**
  - 壁纸：`source/images/wallpaper-dark.webp`（538 KB）/ `wallpaper-light.webp`（88 KB），
    2560×1440 webp q72；`_config.butterfly.yml` 的 `background` 指向暗色那张（主题只支持一张），
    亮色由 `everforest.css` 第十七节覆盖 `#web_bg` 的 `background-image`（内联样式，必须 `!important`）
  - 遮罩：暗色从主题自带的 70% 压到 40%；亮色主题没遮罩，自己补 55% 米白；
    `#web_bg.bg-animation` 的 4s 淡入已关掉（否则首屏先空 4 秒）
  - 玻璃底：新增 `--ef-glass`（暗 `rgba(46,56,60,.72)` / 亮 `rgba(248,245,228,.74)`），
    `--card-bg` 指向它 —— 主题卡片全自动半透明
  - 模糊：`custom.css` 第十四节，`backdrop-filter: blur(16px) saturate(1.15)`；
    列表行（`.lib-item`）只半透明不加 blur，控件保持实色，窄屏降到 blur(10px)，
    `@supports not` 回退成不透明
  - 桌面验证过首页 / 文章页 / 文章库 / 说说页（暗色）+ 首页（亮色）共 5 张截图
  - 已推送：`c5a5a1e`（代码）+ `1c93709`（状态）；线上 CI 已 success
- 最近完成（11-09）：**图片组分档 + 列表缩略图 + 说说插图**（细节见 `docs/agent/01`）
  - `scripts/img-group.js`（Markdown 阶段包 `<div class="ph-imgs ph-imgs--N">`）+ `scripts/img-thumb.js`
    （HTML 阶段兜底 + 列表图换缩略图）；`tools/make-thumbs.py` 生成 `source/images/thumbs/`
  - 管理页说说卡片：「插入图片」内嵌图库面板 +「自动 / 单列 / 两列 / 三列 / 四列」下拉（写 YAML `layout`）
  - 顺手修 `line` 字段被写回 `shuoshuo.yml` 的 bug；`home.js` 时间流头像补 `no-lightbox`
  - **首屏重排 CLS 0.13 → 0.02**（剩 0.018 是歌词卡搬进吸附区那一下）
- 最近完成（10-31，`bb0e888`）：作者卡 / 手机侧滑栏的「文章·标签·分类」三格 → `/library/`
  （`custom.js` 的 `linkSiteDataToLibrary()`，两处 DOM 都要覆盖）；公告换行改由
  `custom.css` 的 `white-space: pre-wrap` 保住（`home.js` 用 textContent，不吃 `\n`）；
  favicon 换 `source/img/favicon-cloud.ico`；启用不蒜子（`busuanzi` 三开关 = true）
- 最近完成（10-30，`08a0bba`）：首屏提速（灯箱换本地文件 + 站点脚本 `defer` +
  `/feed.json`/`/site.json` 在 `<head>` 预取 `window.__homeData` + `home-pending` 期间画骨架；
  三栏出现 462→221ms）+ 正文字号 14→16px
- 更早：站内视频支持、全站换字体、说说页、文章库、歌曲页 —— 细节看 git log 与 `docs/agent/`

## 未完成

- **亮色模式的卡片边框几乎看不见**：`--ef-bg3`（#edeada）在米白玻璃 + 浅色壁纸上边界很淡，
  要不要给亮色单独加深一档，等看几天观感再定。

## 入口

| 项 | 位置 |
|---|---|
| 仓库 / 远端 | `~/blog` → `NitsugaoO/NitsugaoO.github.io`（**仓库名不能改**，否则发布路径变成子目录） |
| 配色权威 | `~/Themes/themes/everforest/tokens.yaml`（本仓库只是应用方） |
| 自定义样式 | `source/css/everforest.css`（配色）、`source/css/custom.css`（非配色；5.5 节=首页骨架、十一节=图片组、十三节=正文字号） |
| 网页字体 | `tools/build-fonts.py` → `source/fonts/JetBrainsMapleMono/`、`source/css/fonts.css` |
| 壁纸 | `source/images/wallpaper-{dark,light}.webp` → `#web_bg`（开关在 `_config.butterfly.yml` 的 `background`，遮罩与亮色换图在 `everforest.css` 第十七节） |
| 亚克力 | `--ef-glass` / `--card-bg`（`everforest.css` 1.1 / 2.1）+ 模糊规则（`custom.css` 第十四节） |
| 列表缩略图 | `tools/make-thumbs.py` → `source/images/thumbs/`（增量清单 `tools/.thumb-manifest.json`，已 gitignore） |
| 图片组 / 缩略图改写 | `scripts/img-group.js`（Markdown 阶段分组）、`scripts/img-thumb.js`（HTML 阶段兜底 + 缩略图） |
| 媒体路径改写 | `scripts/img-path.js`（`../images/`、`../videos/` → 站点绝对路径；跳过代码块 / `{% raw %}` / 行内代码） |
| 站内视频 | `source/videos/`（原样复制到 `/videos/`）；**单文件 ≤ 25 MiB**，文件名不能以 `_` 开头 |
| 独立静态页 | `source/exercise/`（练习产物，**勿手改**；源码 `~/Desktop/数学相关作业/quiz-build`）与 `source/wangan-cards/index.html`（单文件记忆卡）；靠 `_config.yml` 的 `skip_render`（`exercise/**`、`wangan-cards/**`）原样复制 |
| 灯箱（本地） | `source/js/vendor/fancybox.umd.min.js` + `source/css/fancybox.css` |
| 自定义行为 | `source/js/custom.js`、`source/js/home.js`、`source/js/library.js`、`source/js/songs.js` |
| 本地管理页 | `admin/`（`server.js` 后端、`content.js` 数据、`fonts.js` 字体、`public/app.js` 前端） |
| 站点脚本（要重启） | `scripts/*.js`（library-data / site-data / updated-from-git / custom-codeblock / img-path / img-group / img-thumb） |
| 数据文件 | `source/_data/{lyrics,shuoshuo,site,link}.yml` |
| 辅助脚本 | `scripts/sync.sh`（发布 / 重启预览 / 查色值残留） |
| 部署 | `.github/workflows/pages.yml`、`wrangler.jsonc`（CF，需 `NODE_VERSION=22`） |
