# 博客开工规矩

> pi 在 `~/blog`（或子目录）启动时自动加载本节。
> **状态（阶段 / 下一步 / 待验证）只看 [`STATE.md`](STATE.md)**；用户怎么写作看 [`README.md`](README.md)。

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
| 现在做到哪、下一步 | `STATE.md` |

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
8. **CSS 里两个 `:has()` 死法**（都会静默出错，没有报错信息）：
   `p:has(> a ~ a)` 会把「一段文字里有两个普通链接」当成图片行 → 拆成网格、撑出大片空白；
   `:has()` 里面再套 `:has()` 是非法语法 → 整条规则被浏览器丢弃。图片行请用
   `p:has(> a:nth-of-type(2) > img)`。

## 常用验证

```bash
pnpm exec hexo generate                    # 生成（必须成功）
bash scripts/sync.sh --check '#78818a'     # 查旧色值残留（排查"改了没生效"）
pnpm exec hexo server                      # 本地预览 http://localhost:4000
```

## 收尾清单

1. `hexo generate` 通过（改过配置/脚本先 `clean`）
2. 更新 `STATE.md` 三节 + 首行 `code`
3. 文档与实际不符 → 改 `docs/agent/` 里的对应专题（不要往 `AGENTS.md` 里堆细节）
4. 提交：日常用 `git commit`；要发布用 `bash scripts/sync.sh "描述"`（add + commit + push）
5. 汇报里写清：改了哪些文件、是否需要 `hexo clean` / 重启预览、是否已发布
