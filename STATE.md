# 博客状态

updated: 2026-10-28 · code: `b58da96`（最后一次改动站点代码/配置的提交，含 `admin/`）

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
- 本地管理页：`pnpm admin` → `http://127.0.0.1:5173`（增删改文章/说说/歌单/图片，顶栏区分
  未保存 / 已保存未发布 / 已同步，可发布）
- 最近完成（10-24 一批，`e86561c` 为止）：
  - 歌曲页（`93c904e` 感想 / 添加时间 / 随机开关）+ 网易云搜索添加 + LRC/翻译自动拉取
    （`ce5dcfe` 双语歌词）；歌词卡 hover 展开感想、感想支持 Markdown（`8742650`、`ec12987`）
  - 管理页图片管理（`88bec70`、`4d89c4d`）：引用追踪 / 拖拽与粘贴上传 / 按来源筛选 /
    同格式替换 / 删除到回收站 / 外部图片下载本地化
  - 首页右栏：隐藏网站信息卡、左右栏吸附高度对齐、单行感想渐变修复（`665b8af`、`f25af89`、`767a8c4`）
- 最近完成（10-28，`b58da96`）：图片管理三项 —— ① 删除后列表不消失（根因：npm `trash` CLI
  在本机静默失败，已换成 `moveToTrash()`＝PowerShell 回收站 API，删文章一起获益）
  ② 重命名（扩展名不可改，自动改写所有引用）③ 点图/「引用」按钮复制 `![](/images/xxx)`
  **验证**：`node --check` + 起 5173 端到端实测（删除真进回收站、重命名同步改引用、删文章真删）
  + `hexo generate` 通过（33 files）；`sync.sh --check` 未跑（没动配色变量）

## 下一步

1. 图片管理可选项（**暂缓，不做也能用**）：重命名用 `window.prompt`，可改卡片内联输入（非必须）
2. 歌曲页目前只展示列表，没做播放器；侧栏歌词卡仍是「无声按时间轴滚动」
3. 网易云接口（搜索 / 歌词 / 翻译）是外部依赖，失效时管理页会提示手动粘贴；
   真挂了就退回手动维护 `lyrics.yml` + `source/lrc/*.lrc`

## 待验证

```bash
pnpm exec hexo generate        # 必须成功（改过 _config / scripts 先 pnpm exec hexo clean）
                               # ✅ 2026-10-28 通过（33 files）
bash scripts/sync.sh --check '#78818a'   # 旧色值残留（改了样式没生效时用）
                               # 2026-10-28 未跑：没动配色变量
gh run list --limit 3          # 发布后看构建状态（GitHub Pages）
pnpm admin                     # ✅ 2026-10-28 已验：删除→回收站且列表消失 / 重命名改引用 / 点图复制 md
```

改完 `source/css/`、`_config*.yml` 必须重新生成；改过 `scripts/` 必须重启 `hexo server`。

## 入口

| 项 | 位置 |
|---|---|
| 仓库 / 远端 | `~/blog` → `NitsugaoO/NitsugaoO.github.io`（**仓库名不能改**，否则发布路径变成子目录） |
| 配色权威 | `~/Themes/themes/everforest/tokens.yaml`（本仓库只是应用方） |
| 自定义样式 | `source/css/everforest.css`（配色）、`source/css/custom.css`（非配色） |
| 自定义行为 | `source/js/custom.js`、`source/js/home.js`、`source/js/library.js`、`source/js/songs.js` |
| 本地管理页 | `admin/`（`server.js` 后端、`content.js` 数据、`public/app.js` 前端） |
| 站点脚本（要重启） | `scripts/*.js`（library-data / site-data / updated-from-git / custom-codeblock） |
| 数据文件 | `source/_data/{lyrics,shuoshuo,site,link}.yml` |
| 辅助脚本 | `scripts/sync.sh`（发布 / 重启预览 / 查色值残留） |
| 部署 | `.github/workflows/pages.yml`、`wrangler.jsonc`（CF，需 `NODE_VERSION=22`） |
