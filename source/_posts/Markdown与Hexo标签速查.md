---
title: Markdown 与 Hexo / Butterfly 标签速查
date: 2026-10-23 22:30:00
description: 写文章时会用到的 Markdown 基础语法、Butterfly 标签插件和 Hexo 内置标签，每种都带效果预览。
type: note
top_img: false
---

写文章时的速查表。每种语法都先给写法、再给实际效果。示例里的 Hexo 标签用 raw 标签包住，避免这篇笔记自己被执行；「效果」部分是真实渲染。

## 一、Markdown 基础

### 标题

```markdown
# 一级标题
## 二级标题
### 三级标题
```

> 文章标题由 front-matter 的 `title` 渲染，正文里别再写一级标题。本页的各级标题就是效果。

### 强调

```markdown
**粗体**  *斜体*  ~~删除线~~  `行内代码`
```

效果：**粗体**　*斜体*　~~删除线~~　`行内代码`

### 链接

```markdown
[显示文字](https://example.com)
[带提示](https://example.com "悬停文字")
```

效果：[显示文字](https://example.com)　[带提示](https://example.com "悬停文字")

站内链接用绝对路径：

```markdown
[关于我](/about/)
[文章库的 CTF 标签](/library/?tag=CTF)
```

效果：[关于我](/about/)　[文章库的 CTF 标签](/library/?tag=CTF)

引用式（URL 长或多次使用）：

```markdown
见 [官方文档][bf]。

[bf]: https://butterfly.js.org/
```

效果：见 [官方文档][bf]。

[bf]: https://butterfly.js.org/

### 图片

```markdown
![描述](/images/tsctf2026/image-1.png)
```

效果：

![描述](/images/tsctf2026/image-1.png)

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

效果：

- 无序
- 列表

1. 有序
2. 列表

- [ ] 待办
- [x] 已完成

### 代码

````markdown
`行内代码`

```python
print('hello')
```
````

效果：`行内代码`

```python
print('hello')
```

### 表格

```markdown
| 列 1 | 列 2 |
|---|---|
| a | b |
```

效果：

| 列 1 | 列 2 |
|---|---|
| a | b |

### 引用与分割线

```markdown
> 引用内容

---
```

效果：

> 引用内容

---

### 数学公式

front-matter 加 `katex: true`，然后：

```markdown
行内：$a^2 + b^2 = c^2$

块级：
$$
c \equiv m^e \pmod n
$$
```

效果：行内 $a^2 + b^2 = c^2$

$$
c \equiv m^e \pmod n
$$

## 二、Butterfly 标签

### 提示框 note

写法：

{% raw %}
```markdown
{% note warning %}
这里是警告
{% endnote %}
```
{% endraw %}

效果：

{% note warning %}
这里是警告
{% endnote %}

`modern` 样式（在 note 标签里加 `modern`）：

{% note info modern %}
现代样式的提示框
{% endnote %}

类型：`default` / `primary` / `info` / `success` / `warning` / `danger`。

### 折叠 hideToggle / hideBlock / hideInline

写法：

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

效果：

{% hideToggle 点开看答案 %}
折叠起来的内容
{% endhideToggle %}

{% hideBlock 点击展开 %}
块级内容
{% endhideBlock %}

行内：{% hideInline 藏起来的内容, 点我 %}

### 选项卡 tabs

写法：

{% raw %}
```markdown
{% tabs 演示 %}
<!-- tab 第一个 -->
内容一
<!-- endtab -->
<!-- tab 第二个 -->
内容二
<!-- endtab -->
{% endtabs %}
```
{% endraw %}

效果：

{% tabs 演示 %}
<!-- tab 第一个 -->
这是第一个标签页的内容。
<!-- endtab -->
<!-- tab 第二个 -->
这是第二个标签页的内容。
<!-- endtab %}
{% endtabs %}

### 标签 label

写法：

{% raw %}
```markdown
{% label 绿色 green %}
```
{% endraw %}

效果：{% label 绿色 green %}　{% label 蓝色 blue %}　{% label 警告 red %}

颜色：`default` / `blue` / `pink` / `red` / `purple` / `orange` / `green`。

### 按钮 button

写法：

{% raw %}
```markdown
{% btn 'https://example.com', '点我', 'fas fa-link' %}
```
{% endraw %}

效果：{% btn 'https://example.com', '点我', 'fas fa-link' %}

### 时间轴 timeline

写法：

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

效果：

{% timeline 2026 %}
<!-- timeline 10-01 -->
做了什么
<!-- endtimeline -->
<!-- timeline 10-20 -->
又做了什么
<!-- endtimeline %}
{% endtimeline %}

### 友链卡片 flink

里面的内容是一段 **YAML**，不是 Markdown 列表：

{% raw %}
```markdown
{% flink %}
- class_name: 示例分组
  class_desc: 卡片说明
  link_list:
    - name: Everforest
      link: https://github.com/sainnhe/everforest
      avatar: /img/everforest.png
      descr: 本站配色的源头
{% endflink %}
```
{% endraw %}

效果：

{% flink %}
- class_name: 示例分组
  class_desc: 卡片说明
  link_list:
    - name: Everforest
      link: https://github.com/sainnhe/everforest
      avatar: /img/everforest.png
      descr: 本站配色的源头
{% endflink %}

### 相册 gallery

写法：

{% raw %}
```markdown
{% gallery %}
![图一](/images/tsctf2026/image-1.png)
![图二](/images/tsctf2026/image-2.png)
{% endgallery %}
```
{% endraw %}

效果：

{% gallery %}
![图一](/images/tsctf2026/image-1.png)
![图二](/images/tsctf2026/image-2.png)
{% endgallery %}

### 行内图片 inlineImg

写法：

{% raw %}
```markdown
{% inlineImg /img/cloud.jpg 80px %}
```
{% endraw %}

效果：{% inlineImg /img/cloud.jpg 80px %}

### 系列文章 series

写法：

{% raw %}
```markdown
{% series %}
{% series 数学分析 %}
```
{% endraw %}

效果（当前没有 `series` 字段的文章，所以是空的）：

{% series %}

> 按文章的 `series` 字段分组，文章多了以后会自动列出。

### Mermaid 流程图

需要先在 `_config.butterfly.yml` 打开 `mermaid.enable`，当前是关闭的：

{% raw %}
```markdown
{% mermaid %}
graph TD
  A --> B
{% endmermaid %}
```
{% endraw %}

效果（配置关闭时不显示）：{% mermaid %}graph TD
  A --> B
{% endmermaid %}

## 三、Hexo 内置标签

### 代码块 codeblock

写法与效果：

{% codeblock lang:python %}
print('带文件名的代码块')
{% endcodeblock %}

### 引用 quote

{% quote %}
这是引用内容，和 Markdown 的 `>` 类似，但可以带出处。
{% endquote %}

### iframe / youtube

{% raw %}
```markdown
{% iframe https://example.com 100% 400 %}

{% youtube 视频id %}
```
{% endraw %}

这两个会嵌入外部页面/视频，需要真实链接才有内容，这里不演示。

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

1. **示例里的 Hexo 标签必须包在 raw 标签里**，否则会被真的执行（连行内代码里的也会）。
2. 站内链接一律用 `/...` 绝对路径，别用相对路径。
3. 图片路径也要绝对：`/images/...`、`/img/...`。
4. 数学公式要在 front-matter 写 `katex: true`。
5. 改完文章记得在管理页点「保存」，再点「发布」才会推到线上。
