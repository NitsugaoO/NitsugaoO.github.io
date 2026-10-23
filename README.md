# 呜云 WooYun : Blog

个人博客：CTF Writeup / 学习笔记 / 软件配置 / 生活琐事。

技术栈：**Hexo 8** + **Butterfly 5.7** + **Everforest 配色**（hard 档）

---

## 每天只用记三个命令

全部在 `C:\Users\Agustin\blog` 目录下执行。

### 1. 新建文章

```bash
pnpm exec hexo new "文章标题"
```

会在 `source/_posts/` 下生成 `文章标题.md`，开头自带一段 **front-matter**：

```yaml
---
title: 文章标题
date: 2026-10-16 14:30:00
tags:
---
```

这段 `---` 包起来的 yaml 就是文章的「身份证」，标题、时间、标签、分类都从这里读。
建议补全成：

```yaml
---
title: 文章标题
date: 2026-10-16 14:30:00
tags: [Pwn, 栈溢出]
categories: [CTF]
katex: true          # 需要写数学公式时加上
---
```

### 2. 本地预览

```bash
pnpm exec hexo server
```

浏览器打开 <http://localhost:4000>，保存 md 后刷新即可看到效果。
关掉那个命令行窗口就停止预览了。

### 3. 备份（Git）

```bash
git add -A
git commit -m "新增：xxx 题解"
```

> 上线到 Cloudflare Pages 之后，再加一步 `git push`，网站会自动更新。

---

## 常见需求

### 插图

图片放在 `source/images/<文章名>/` 目录，正文里这样引用：

```markdown
![描述](/images/tsctf2026/image-1.png)
```

> 注意用 `/images/...` 开头的绝对路径，不要用相对路径。

### 数学公式

在 front-matter 里写 `katex: true`，正文里用：

```markdown
行内公式：$a^2 + b^2 = c^2$

块级公式：
$$
c \equiv m^e \pmod n
$$
```

### 代码块

````markdown
```python
from pwn import *
io = remote('1.2.3.4', 9999)
```
````

支持高亮：`python` / `c` / `bash` / `asm` / `javascript` / `html` 等。

### 提示框

```markdown
{% note warning %}
这里是警告内容
{% endnote %}
```

可用：`note default` / `note primary` / `note info` / `note success` / `note warning` / `note danger`

### 折叠内容（藏 flag 很有用）

```markdown
{% hideToggle flag %}
TSCTF-J{xxxxx}
{% endhideToggle %}
```

### 创建时间与修改时间

文章有**两个时间**，已经分开：

| 时间 | 来源 | 显示 |
|---|---|---|
| 创建时间 | front-matter 的 `date` | 文章页「发表于」、首页卡片、文章库、管理页 |
| 修改时间 | **Git 最后一次提交时间** | 文章页「更新于」、首页卡片/文章库的「更新 xxx」、管理页 |

- 修改时间不会因为保存文件、格式化、`git checkout` 而变，只看内容有没有被提交
- 想手动指定修改时间，在 front-matter 写 `updated: 2026-10-23 17:00:00`，优先级最高
- 注意：本地改了但还没 commit 时，修改时间不会变（发布后才变）

> 改过 `_config.yml` 的 `updated_option` 之后，第一次要跑 `pnpm exec hexo clean`，
> 否则 Hexo 会用缓存里的旧时间。

---

## 本地管理页

不想手改 md/yml 时，可以用管理页：

```bash
dir C:\Users\Agustin\blog
pnpm admin
```

浏览器打开 <http://127.0.0.1:5173>，可以管理：

| 页面 | 对应文件 |
|---|---|
| 文章 / 笔记 | `source/_posts/*.md` |
| 说说 | `source/_data/shuoshuo.yml` |
| 友链 | `source/_data/link.yml` |
| 关于 | `source/about/index.md` |
| 公告 | `source/_data/site.yml` |

文章编辑器里：

- **分类 / 标签** 下方会列出所有文章里出现过的值，点一下直接追加（避免同一个分类因空格差异被拆成两个）
- **课程 / 来源** 是笔记专用字段（对应 front-matter 的 `course` / `source`），普通文章留空即可，保存时不会写进 md
- **VSCode** 按钮：用 `code -g` 在 VSCode 里打开当前文件（写完存盘，管理页会自动刷新）
- **封面 / 友链头像**：输入路径后直接显示缩略图（图片不存在时半透明提示）

### 草稿与外部编辑

文章分两种状态：

| 状态 | 目录 |
|---|---|
| 已发布 | `source/_posts/` |
| 草稿 | `source/_drafts/`（Hexo 默认不会生成） |

- 列表顶部可以按 **全部 / 已发布 / 草稿** 筛选，每条前面有状态标记
- 草稿编辑器的「转为已发布」会把文件从 `_drafts` 移到 `_posts`
- 你完全可以在 VSCode 里直接编辑 `source` 下的 md：管理页每 3 秒、以及窗口重新聚焦时会自动检测文件变化；顶栏的「刷新」按钮可以手动重拉
- 「站点预览」会用 `--draft` 启动 `hexo server`，所以草稿在本地也能点开看；线上构建不带动参数，不会发布草稿
- 说说页每条也有「VSCode」按钮：打开 `source/_data/shuoshuo.yml` 并定位到那条，
  改完保存，管理页会自动刷新；旁边的「预览」按钮按 Markdown / 公式渲染当前内容

顶栏四个按钮：

- **站点预览**：检查 `hexo server`（4000 端口）有没有在跑——没跑就启动它，
  然后打开浏览器。正在编辑文章时直接打开那篇文章的页面，否则开首页
- **保存**：直接写回仓库文件（改完刷新 4000 就能看效果）
- **重新生成**：跑一次 `pnpm exec hexo generate`
- **发布**：`git add -A` + `commit` + `push`，和 `sync.sh` 一样，会触发两个平台部署

`Ctrl + S` 等于当前页面的保存。

地址栏参数（可以收藏）：

| 参数 | 作用 |
|---|---|
| `?preview=1` | 打开文章时默认展开右侧预览 |
| `?file=文章.md` | 直接打开某篇文章 |
| `?view=shuoshuo` | 直接打开某个视图（`posts`/`shuoshuo`/`link`/`about`/`site`） |

> 管理页只监听 `127.0.0.1`，外面访问不到；它也没有登录密码，
> **不要**把它改成 `0.0.0.0` 或反向代理到公网。

---

## 目录结构

```
C:\Users\Agustin\blog\
├── source\
│   ├── _posts\          ← 你的文章全在这里（.md 文件）
│   ├── _data\           ← 结构化内容（说说、友链、站点文案）
│   ├── images\          ← 文章配图
│   ├── css\
│   │   └── everforest.css   ← 【配色在这里改】
│   ├── about\           关于页
│   ├── tags\            标签页
│   └── categories\      分类页
├── admin\               本地管理页（不在网站上发布）
├── themes\butterfly\    主题（已纳入 Git 管理）
├── _config.yml          整站配置（博客名、作者、网址）
├── _config.butterfly.yml  主题配置（外观、导航、评论、主题色）
└── public\              编译产物（自动生成，不用管）
```

---

## 内容数据文件

除了文章，其余内容都是 `source/_data/` 下的 YAML。**这些文件只放纯数据，不要写注释**
（管理页保存时会整份重写，注释会丢；字段说明就写在这一节）。

### `site.yml` — 站点文案

| 字段 | 说明 |
|---|---|
| `announcement` | 首页左栏的公告板文案，留空则不显示 |

### `shuoshuo.yml` — 说说

| 字段 | 说明 |
|---|---|
| `date` | 时间，格式 `YYYY-MM-DD HH:mm:ss`，页面按它倒序 |
| `content` | 正文，支持完整 Markdown、Hexo 标签（`{% hideToggle %}` 等）、KaTeX |
| `tags` | 标签数组（可选） |

图片放在 `source/images/` 或 `source/img/`，正文里写绝对路径 `/images/xxx.png`。

### `link.yml` — 友链

| 字段 | 说明 |
|---|---|
| `class_name` | 分组名（页面上会变成小标题） |
| `class_desc` | 分组说明（可省略） |
| `link_list` | 站点列表 |
| `link_list[].name` | 站点名 |
| `link_list[].link` | 链接 |
| `link_list[].avatar` | 头像（建议 100×100，本地放 `source/img/`） |
| `link_list[].descr` | 一句话描述 |

### `widget.yml` — 侧栏卡片

| 字段 | 说明 |
|---|---|
| `top` / `bottom` | 插槽：`top` 在所有页面显示，`bottom` 只在首页/归档等非文章页显示 |
| `class_name` | 额外 class（写样式时用） |
| `id_name` | 元素 id |
| `name` | 卡片标题 |
| `icon` | 标题左侧的 Font Awesome 图标 |
| `order` | 排序（可选） |
| `html` | 卡片正文，纯 HTML |

歌词卡的内容由 `source/js/custom.js` 从 `source/js/lyrics-data.js` 渲染，
**换歌、改歌词请编辑 `lyrics-data.js`**，不要改 `widget.yml` 里的那份 HTML（它只是禁用 JS 时的兜底）。

---

## 评论系统

用的是 **Giscus**（GitHub Discussions 驱动），文章页、关于页、说说页都有。

| 项目 | 值 |
|---|---|
| 仓库 | `NitsugaoO/NitsugaoO.github.io` |
| 分类 | Announcements（只有你能发 discussion，访客只管评论） |
| 映射 | 文章/关于用 `pathname`，说说用 `specific + key` |

访客需要有 GitHub 账号才能评论。评论数据就在仓库的 **Discussions** 里，
可以直接在 GitHub 上查看、回复、删除。

两个需要知道的前置条件：

1. 仓库 **Settings → Features → Discussions** 已开启（已完成）
2. 已安装 [giscus App](https://github.com/apps/giscus) 并授权本仓库

新增说说时管理页会自动生成 `key`（说说评论区靠它区分），手动写 YAML 的话记得加：

```yaml
- date: 2026-10-24 10:00:00
  key: shuoshuo-20261024-1000
  content: |
    ……
```

---

## 改配色

配色分**两处**，改完都要重新 `pnpm exec hexo generate`（或重启 `hexo server`）：

### 1. `source/css/everforest.css` — 全站颜色

文件开头有 `--ef-*` 色板变量，对齐 `C:\Users\Agustin\Themes\themes\everforest\tokens.yaml` 的角色名：

```css
html[data-theme='dark'] {
  --ef-bg0:   #272e33;   /* 一级背景：页面 */
  --ef-bg1:   #2e383c;   /* 二级面板：卡片、代码块 */
  --ef-green: #a7c080;   /* 主强调色 */
  --ef-fg:    #d3c6aa;   /* 正文 */
  /* ... */
}
```

改这里能影响：页面背景、卡片、侧栏、按钮、代码块外框、语法高亮、提示框、标签色。

### 2. `_config.butterfly.yml` — `theme_color` 段

Butterfly 有一批颜色**不走 CSS 变量**，而是编译时直接写死进 CSS（比如导航 hover 下划线、页脚、分页器）。
这些必须通过配置改：

```yaml
theme_color:
  enable: true
  main: "#a7c080"     # 主强调色
  link_color: "#7fbbb3"
  # ...
```

> ⚠️ 如果改色后还看到旧颜色，先 `Ctrl + Shift + R` 强制刷新浏览器（排除缓存）。

---

## 主题升级

Butterfly 主题已直接纳入本仓库（没有用 git submodule）。升级方式：

```bash
cd C:\Users\Agustin\blog
git clone --depth=1 -b master https://github.com/jerryc127/hexo-theme-butterfly.git _butterfly_new
# 对比差异后替换
```

因为配色全部走 `source/css/everforest.css` 覆盖，**主题升级不会影响你的配色**。

---

## 部署（两个平台）

本博客同时发布到两处，**push 到 GitHub 即自动构建**，无需手动操作：

| 平台 | 网址 | 说明 |
|---|---|---|
| GitHub Pages | <https://nitsugaoo.github.io/> | 海外访问快 |
| Cloudflare Workers | <https://blog.wooyun.workers.dev/> | 国内有时需代理 |

### 发布流程（三个命令缺一不可）

```bash
cd C:\Users\Agustin\blog
git add -A
git commit -m "新增：xxx"
git push        # ← 少了这步，网站不会更新（Cloudflare/GitHub 拉的是远程仓库）
```

等 1~2 分钟即可在两个地址看到新内容。

### 两个平台各自的配置

**GitHub Pages** — 由 `.github/workflows/pages.yml` 驱动：
`pnpm install` → `pnpm run build` → 把 `public/` 发布出去。

**Cloudflare Workers** — 控制台配置：

| 字段 | 值 |
|---|---|
| Build command | `pnpm run build` |
| Deploy command | `npx wrangler deploy` |
| Build output directory | 不在这里，由仓库的 `wrangler.jsonc` 指定（`assets.directory = ./public`） |
| 环境变量 | `NODE_VERSION = 22` |

### 两个关键约束

**① `url` 只能填一个（当前填的是 Cloudflare 地址）**

它决定 RSS、sitemap 和页面 canonical 链接。另一个平台的页面会把这个地址当作“规范地址”——这是有意为之，能让搜索引擎知道两个地址是同一篇内容，避免被判重复。

**② 仓库名不能随便改**

仓库特意叫 `NitsugaoO.github.io`。因为 GitHub Pages 默认把站点发布在 `用户名.github.io/仓库名/`（带子路径），而 Cloudflare 是根路径——**资源路径前缀不一致会导致 CSS/JS 404**。用这个名字后 GitHub 也发布到根路径，两边配置才能共用一份。

### 如果构建失败

去 GitHub 的 **Actions** 标签页看日志；Cloudflare 则看 **Workers & Pages → 项目 → Deployments**。

最常见的两个坑：

- **`Setup pnpm : failure`** —— workflow 里同时写了 `version` 和 `package.json` 的 `packageManager` 字段，两者冲突。只保留后者。
- **Cloudflare 报 API token 失效** —— 去项目 Settings 重新授权 GitHub。
