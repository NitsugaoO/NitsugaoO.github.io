# 博客开工规矩

> pi 在 `~/blog`（或子目录）启动时自动加载本节。
> **状态（阶段 / 未完成 / 入口）只看 [`STATE.md`](STATE.md)**；用户怎么写作看 [`README.md`](README.md)。

## 开工第一步

**先读 [`STATE.md`](STATE.md)**（不超过一屏）。它首行的 `code` 是**最后一次改动
站点代码/配置的提交**，用它判过期：

```bash
git log -1 --format=%h -- source scripts admin tools _config.yml _config.butterfly.yml
```

只改文章（`source/_posts/`）的提交不算过期。**用户可能有未提交的在途改动，先看
`git status`，不要擅自提交或覆盖。**

## 先看哪里

| 想知道 | 看 |
|---|---|
| 改配色 / 样式 / 布局 / 组件 / 自定义代码块 / 数学公式 | [`docs/agent/01-配色与样式.md`](docs/agent/01-配色与样式.md) |
| 文章 / 歌曲 / 说说 / 公告 / 评论 / 管理页 | [`docs/agent/02-内容与数据.md`](docs/agent/02-内容与数据.md) |
| 生成 / 预览 / 发布 / 不能碰的约束 | [`docs/agent/03-构建与发布.md`](docs/agent/03-构建与发布.md) |
| 怎么写作、日常三条命令、数据文件字段 | [`README.md`](README.md)（给用户看的） |
| 现在做到哪、未完成 | `STATE.md` |

配色权威不在本仓库：`~/Themes/themes/everforest/tokens.yaml`（博客只是它的一个应用）。

## 最容易出事的规则（违反会白干）

1. **改完 `source/css/` 或 `_config*.yml` 必须 `pnpm exec hexo generate`**，否则页面还是旧的。
2. **`scripts/` 下的站点脚本只在进程启动时加载** → 改完必须重启 `hexo server`；
   改过 `updated_option` 或代码块相关配置还要 `hexo clean`（Hexo 缓存渲染结果）。
   改 `_config*.yml` 后也一样要 `bash scripts/sync.sh --restart` —— `hexo server` 有**渲染缓存**，
   只 generate 不重启，刷出来还是旧页面（改站点 `title` 时踩过）。
3. **不修改 `themes/butterfly/`**（主题要能 `git pull` 升级）；所有定制放 `source/` 下的自定义文件。
4. **发布 = add + commit + push 三步**。只 commit 不 push，GitHub Pages 和 Cloudflare 都拉不到代码。
5. 改完只在本地看，记得 **Ctrl+Shift+R** 强刷（普通 F5 用缓存 CSS）。
6. **图片路径分两种写法**：md 正文写相对路径 `../images/xxx`（`scripts/img-path.js` 渲染时转回
   `/images/xxx`，VSCode 预览才看得到图）；**front-matter 的 `cover` / `avatar` 必须绝对路径**
   `/images/xxx`（不走 Markdown 渲染，写相对路径线上必 404）。
7. **网页字体是子集化的**：正文里出现字体没有的字（生僻字 / 新符号）→ 管理页「字体」页会黄字报缺字，
   点「重新生成子集」（或 `python tools/build-fonts.py`），别只改 CSS 硬撑。
8. **正文图片组走 `.ph-imgs`，不要再写 `:has()` 数张数**：连续写的图片由
   `scripts/img-group.js` 在 Markdown 阶段包成 `<div class="ph-imgs ph-imgs--N">`，
   CSS 只按 class 排版（`custom.css` 第十一节）。原来那套 `p:has(...)` 已删：
   它数不出「这一段几张」、会误伤「文字 + 一张图」的段落，`:has()` 嵌套还是非法语法
   （静默失败，没有报错）。另一个坑：任何「容器里所有 img」的规则
   （如 `.shuoshuo-content img`）都会把网格的比例顶掉，必须限定成 `> p img`。
9. **网易云接口（搜索 / 歌词 / 翻译）是外部依赖**：失效时管理页会提示手动粘贴，
   真挂了就退回手动维护 `source/_data/lyrics.yml` + `source/lrc/*.lrc`，别去反向破解接口。
10. **首页首屏的三处改动是一对**：`<head>` 的 `window.__homeData` 预取、`inject.bottom` 的 `defer`、
    `.home-pending` 骨架。删掉预取不会坏（`home.js` 会自己 fetch），但会退回慢路径。
11. **灯箱换版本要成对换**：`source/js/vendor/fancybox.umd.min.js` 和 `source/css/fancybox.css`
    （版本号要与 `themes/butterfly/plugins.yml` 一致），只换一个会样式/行为错位。
12. **站内视频单文件 ≤ 25 MiB**：超了 CF Workers 整包部署失败；文件名不能以 `_` 开头。
13. **列表用的是缩略图**（`source/images/thumbs/*.webp`，`tools/make-thumbs.py` 生成）：
    原图 17 MB / 6144×8192 直接进首页会把滚动搞卡。上传 / 替换 / 改名会自动补单张；
    **手动把图拷进 `source/images/` 后要去管理页「图片 → 重建缩略图」跑一次**。
    缩略图缺失时站点脚本自动回退原图，不会坏。
14. **首页三栏的布局约束**（动之前先读 `docs/agent/01` 的「首屏不能有二次重排」）：
    · `home-mode` 决定首页专用样式，必须由 `_config.butterfly.yml` 的 head 内联脚本加在
      `<html>` 上，选择器写 `html.home-mode` —— 写成 `body.home-mode` 会晚一拍，
      右栏先按旧布局排完再整块挪动（实测是首屏最大的一笔位移）；
    · 图片组列宽用 `repeat(N, minmax(0, 1fr))`：`1fr` 的最小宽度是 min-content，会撑破中栏；
    · 右栏 `#aside-content` 必须 `flex-shrink: 0`。**别**改用 `flex: 1 1 0%` 去修主区 ——
      内容插入前主区会先缩成 0，右栏瞬间跳到最左边（实测 CLS 0.13 → 0.65，试过不行）。
15. **壁纸 + 亚克力的三处入口，别写错地方**（详见 `docs/agent/01` 的「壁纸与亚克力」）：
    · 壁纸开关在 `_config.butterfly.yml` 的 `background`（非空才生成 `#web_bg`）；主题只支持一张，
      亮色那张靠 `everforest.css` 第十七节覆盖 `background-image`（内联样式，**必须 `!important`**）；
    · 卡片半透明走 `--card-bg: var(--ef-glass)`，**新写的卡片不要硬写 `background: var(--ef-bg1)`**，
      否则它会永远不透明，除非你把它加进 `custom.css` 第十四节的选择器组；
    · 模糊只给「大面板」：列表行（`.lib-item`）不加 blur，按钮 / 输入框 / chip 保持实色；
      `@supports not` 的回退里 `--card-bg` 与 `background` **要成对改回**。

## 改完怎么生效 + 怎么验证

生成 → 重启（改过 `scripts/` 或 `_config*.yml`）→ 强刷（Ctrl+Shift+R）→ 发布（add+commit+push）。

```bash
pnpm exec hexo clean && pnpm exec hexo generate   # 生成必须成功
pnpm exec hexo server                             # 本地预览 http://localhost:4000
pnpm admin                                        # 管理页 http://127.0.0.1:5173
bash scripts/sync.sh --check '#78818a'            # 查旧色值残留（排查"改了没生效"）
gh run list --limit 3                             # 发布后确认 CI 结果
```

### 验证亮色模式（截图看不到时）★

主题的明暗切换**不写 localStorage**、也不会自动切回，无头截图只能看到
`display_mode` 的默认值（本站是 dark）。要截亮色页，别去改 `_config.butterfly.yml`
（要 clean + 重启，慢），直接改生成物：

```bash
pnpm exec hexo generate
sed -i 's/data-theme="dark"/data-theme="light"/' public/index.html
python -m http.server 4100 -d public        # 另开一个静态服务，不动 hexo server
# 截图 http://localhost:4100/  →  完了重新 generate 复原
```

`public/` 已在 `.gitignore`，改完不留痕；但变完记得重新 `hexo generate`，
否则下次启动 `hexo server` 前那份 public 是旧主题。

## 收尾清单

1. `hexo generate` 通过（改过配置/脚本先 `clean`）
2. 更新 `STATE.md` 两节 + 首行 `code`
3. 文档与实际不符 → 改 `docs/agent/` 里的对应专题（不要往 `AGENTS.md` 里堆细节）
4. 提交：日常用 `git commit`；要发布用 `bash scripts/sync.sh "描述"`（add + commit + push）
5. 汇报里写清：改了哪些文件、是否需要 `hexo clean` / 重启预览、是否已发布
