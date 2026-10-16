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

---

## 目录结构

```
C:\Users\Agustin\blog\
├── source\
│   ├── _posts\          ← 你的文章全在这里（.md 文件）
│   ├── images\          ← 文章配图
│   ├── css\
│   │   └── everforest.css   ← 【配色在这里改】
│   ├── about\           关于页
│   ├── tags\            标签页
│   └── categories\      分类页
├── themes\butterfly\    主题（已纳入 Git 管理）
├── _config.yml          整站配置（博客名、作者、网址）
├── _config.butterfly.yml  主题配置（外观、导航、评论、主题色）
└── public\              编译产物（自动生成，不用管）
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
