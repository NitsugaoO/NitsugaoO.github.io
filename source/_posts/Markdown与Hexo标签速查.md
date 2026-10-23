---
title: Markdown 与 Hexo / Butterfly 标签速查
date: 2026-10-23 22:30:00
description: 写文章时会用到的 Markdown 基础语法、Butterfly 标签插件和 Hexo 内置标签。
type: note
top_img: false
---

写文章时的速查表。示例里的 Hexo 标签都用 raw 标签包住，避免这篇笔记自己被执行。

## 一、Markdown 基础

### 标题

```markdown
# 一级标题
## 二级标题
### 三级标题
```

> 文章标题由 front-matter 的 `title` 渲染，正文里别再写一级标题。

### 强调

```markdown
**粗体**  *斜体*  ~~删除线~~  `行内代码`
```

### 链接

```markdown
[显示文字](https://example.com)
[带提示](https://example.com "悬停文字")
```

站内链接用绝对路径：

```markdown
[关于我](/about/)
[文章库的 CTF 标签](/library/?tag=CTF)
[那篇 TSCTF 题解](/2026/10/12/TSCTF2026-WriteUp/)
```

引用式（URL 长或多次使用）：

```markdown
见 [官方文档][bf]，再看一次 [官方文档][bf]。

[bf]: https://butterfly.js.org/
```

### 图片

```markdown
![描述](/images/tsctf2026/image-1.png)
```

图片放 `source/images/` 或 `source/img/`，正文用 `/images/...`、`/img/...` 绝对路径。

### 列表

```markdown
- 无序
- 列表

1. 有序
2. 列表

- [ ] 待办
- [x] 已完成
```

### 代码

````markdown
`行内代码`

```python
print('hello')
```
````

### 表格

```markdown
| 列 1 | 列 2 |
|---|---|
| a | b |
```

### 引用与分割线

```markdown
> 引用内容

---
```

### 数学公式

front-matter 加 `katex: true`，然后：

```markdown
行内：$a^2 + b^2 = c^2$

块级：
$$
c \equiv m^e \pmod n
$$
```

## 二、Butterfly 标签

### 提示框 note

{% raw %}
```markdown
{% note warning %}
这里是警告
{% endnote %}
```
{% endraw %}

类型：`default` / `primary` / `info` / `success` / `warning` / `danger`，加 `modern` 是另一种样式：

{% raw %}
```markdown
{% note info modern %}
现代样式的提示框
{% endnote %}
```
{% endraw %}

### 折叠

{% raw %}
```markdown
{% hideToggle 点开看答案 %}
折叠起来的内容
{% endhideToggle %}

{% hideBlock 点击展开 %}
块级内容
{% endhideBlock %}

{% hideInline 藏起来的内容, 点我 %}
```
{% endraw %}

### 选项卡 tabs

{% raw %}
```markdown
{% tabs 示例 %}
<!-- tab 第一个 -->
内容一
<!-- endtab -->
<!-- tab 第二个 -->
内容二
<!-- endtab -->
{% endtabs %}
```
{% endraw %}

### 标签 label

{% raw %}
```markdown
{% label 绿色 green %}
```
{% endraw %}

颜色：`default` / `blue` / `pink` / `red` / `purple` / `orange` / `green`。

### 按钮 button

{% raw %}
```markdown
{% btn 'https://example.com', '点我', 'fas fa-link' %}
```
{% endraw %}

### 时间轴 timeline

{% raw %}
```markdown
{% timeline 2026 %}
<!-- timeline 10-01 -->
做了什么
<!-- endtimeline -->
<!-- timeline 10-20 -->
又做了什么
<!-- endtimeline -->
{% endtimeline %}
```
{% endraw %}

### 友链卡片 flink

{% raw %}
```markdown
{% flink %}
- name: Butterfly 文档
  link: https://butterfly.js.org/
  avatar: /img/cloud.jpg
  descr: 主题官方文档
{% endflink %}
```
{% endraw %}

### 相册 gallery

{% raw %}
```markdown
{% gallery %}
![图一](/images/a.png)
![图二](/images/b.png)
{% endgallery %}
```
{% endraw %}

### 行内图片 inlineImg

{% raw %}
```markdown
{% inlineImg /img/cloud.jpg 100px %}
```
{% endraw %}

### 系列文章 series

{% raw %}
```markdown
{% series %}
{% series 数学分析 %}
```
{% endraw %}

按文章的 `series` 字段分组。

### Mermaid 流程图 / 图表

需要先在 `_config.butterfly.yml` 打开 `mermaid.enable` / `chartjs.enable`，当前是关闭的。

{% raw %}
```markdown
{% mermaid %}
graph TD
  A --> B
{% endmermaid %}
```
{% endraw %}

## 三、Hexo 内置标签

{% raw %}
```markdown
{% codeblock lang:python 文件名.py %}
print('带文件名的代码块')
{% endcodeblock %}

{% quote %}
引用
{% endquote %}

{% iframe https://example.com 100% 400 %}

{% youtube 视频id %}
```
{% endraw %}

## 四、front-matter 常用字段

```yaml
---
title: 文章标题
date: 2026-10-23 22:30:00
description: 首页卡片和文章头部的简介
tags: [CTF, WriteUp]
categories: [CTF]
katex: true          # 需要数学公式
type: note           # 笔记；不写就是普通文章
top: true            # 置顶
cover: /images/xxx.png
top_img: false       # 关掉文章页横幅
series: 数学分析     # 系列文章
---
```

## 五、几个容易踩的坑

1. **示例里的 Hexo 标签必须包在 raw 标签里**，否则会被真的执行。
2. 站内链接一律用 `/...` 绝对路径，别用相对路径。
3. 图片路径也要绝对：`/images/...`、`/img/...`。
4. 数学公式要在 front-matter 写 `katex: true`。
5. 改完文章记得在管理页点「保存」，再点「发布」才会推到线上。
