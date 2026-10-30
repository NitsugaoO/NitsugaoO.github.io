---
title: 我和我的配置（美化配置篇）
date: '2026-10-29 18:11:38'
description: 介绍我的系统美化
categories: [环境与配置]
tags: [配置, 美化]
cover: /images/5312dcf7a0.png
---

# 前言

此系列介绍我当前使用的设备、一些实用软件与环境、各类配置与做的美化（本文）。希望能给到一些启发。

我想在美化部分之外的部分 主要讲的是一种 使用这台电脑的 工作流 这种感觉。一种“用电脑的思路”。

所以虽然这些部分理论上也是“软件”，但被我从软件篇里分到这里了。

有关 Pi Agent 的介绍决定日后写一篇关于我的 Pi 插件 / 使用经验的文章。

有关 WSL，由于近期都在用 pwn.college 的远程环境，自从参与招新赛之后本地的 WSL 没有什么发展，基本上变成了用来编译计导课 C 代码的环境...几个月后也许会更加有话说。

{% hideToggle 一些有趣的事实 %}

“桌面美化” 在互联网上（尤指 reddit 社区的 unixporn 板块：[r/unixporn](https://www.reddit.com/r/unixporn/)）被称之为 "rice / ricing"。由来：

```
“rice”这个称呼在桌面美化圈里，其实是一段从汽车改装文化里“继承”来的历史，背后还带着一层不太光彩的过往。

🚗 起源：汽车圈里的“Rice Burner”

这个词最初来自20世纪后半叶的美国汽车改装圈。当时一些价格低廉、以外观视觉改装为主（比如夸张的尾翼、霓虹灯、张扬的涂装），但性能提升有限的亚洲进口车（主要是日本车），被带有种族歧视色彩地贬称为“Rice Burner”（煮饭机）。给车做这种风格改装的行为，就被叫做“ricing”。

🔄 演变：从贬义词到“后天缩写”

为了淡化这个词的歧视色彩，汽车圈后来给它安上了一个听起来很专业的“后天缩写（Backronym）”：Race Inspired Cosmetic Enhancement（赛车灵感的外观强化）。这个新定义强调的是一种“重外观、轻性能”的改装哲学，从而完成了从纯粹贬义到一种特定改装风格的语义转换。

💻 跨界：从改装车到改装桌面

Linux/Unix社区（尤其是r/unixporn板块）的爱好者们，把这种“重度视觉定制、追求极致外观，实用性可能退居其次”的精神，完美移植到了操作系统桌面上。他们花大量时间调整窗口管理器、主题、图标、终端配色等，把桌面改得极具个人风格，这种行为便直接借用了汽车圈的“ricing”一词。

（UnixPorn 中的 Porn 是一种在 Reddit 上广泛的命名后缀，大概可以理解为“...的极致视觉图片”，比如说有 FoodPorn、EarthPorn 这种板块...）

所以，当你看到有人说“rice了一个桌面”，就相当于在说“像改装车一样，把我的桌面狠狠‘装修’了一番”。不过需要了解的是，由于其词源本身带有种族色彩，至今仍有一些人对此感到不适，而选择用“theming”（主题化）等更中性的词来替代。
```

此外，由于许多程序的配置文件往往是以 "." 开头的（这源自 Linux 中以 "." 开头的文件一般被视为隐藏的文件，你可以在 home 目录用 `ls -a` 看到；或者在 Windows 上，你也会看到用户目录下有一堆 "." 开头的隐藏文件），这些“配置文件分享”的仓库 / 项目常被称作 `dotfile`。

你可以通过搜索 `ricing / dotfile` 在互联网上找到许多可供美化 / 配置参考的样例。

例如这里有一些本文参考的例子：

[https://github.com/Vabolos/windots](https://github.com/Vabolos/windots)

[https://github.com/ashish0kumar/dotfiles](https://github.com/ashish0kumar/dotfiles)

{% endhideToggle %}

# 画廊

![桌面展示](../images/5312dcf7a0.png)

![日常展示](../images/6d494825ed.png)

![日常展示](../images/40e0a2cd82.png)

![日常展示](../images/0c28f93afb.png)

21 世纪最伟大的开机动画 (bushi)：

<video controls src="../videos/VID_20261030111335804.mp4" title="Title"></video>

# 概述

- 系统：Windows 11
- 配色方案：[EverForest Colorscheme](https://everforest.vercel.app/)，以绿色为主题色的低饱和度护眼主题
- 字体：微软雅黑，[~~FiraCode~~](https://github.com/tonsky/FiraCode) [Jetbrains Maple Mono](https://github.com/SpaceTimee/Fusion-JetBrainsMapleMono)，融合 Jetbrains Mono 与 Maple Mono 的优秀等宽字体方案，中英文 2:1 与可变字体
- 动态壁纸：Wallpaper Engine
- 窗口管理器：[GlazeWM](https://github.com/glzr-io/glazewm)，Windows 上的 i3 式平铺窗口管理器
- 状态栏：[YASB](https://github.com/amnweb/yasb)，一款高度可配置的 Windows 状态栏，使用 Python 编写，支持多种小部件、便捷的主题定制以及深度自定义。
- App 启动器：[tupa-launcher](https://github.com/NitsugaoO/tupa-launcher)，自己 vibe 出来的 `TUi PAllete`
- Agent: [Pi Coding Agent](https://pi.dev/)，保持极简与高可拓展性的 TUI Agent
- 输入法：微信输入法
- 终端：Windows Terminal 和 Powershell，应该暂时不会扎进换终端的深坑之中（）
- 文本编辑器：VSCode，尝试上手 neovim 中
- 浏览器：Microsoft Edge，其实有点想换掉。
- WSL: Ubuntu 24.04

你应该可以在 [这个仓库](https://github.com/NitsugaoO/windows-everforest-rice) 找到本文提到的各个配置文件的成品（和本文没有提到的配置文件...让 AI 整理项目是一门学问）。如果没有的话可以在评论说一声~~或者直接在 QQ / 微信上拷问我~~。

接下来介绍一下一些有趣的部分。

# 美化

用到了 [WindHawk](https://windhawk.net/) 软件，与其中的 5 个 Mod。

除了 `Middle click to close on the taskbar` （在任务栏上中键关闭窗口），剩余的 4 个 Mod 下文会提及。

![](../images/f074262bed.png)

{% hideToggle 什么是 WindHawk %}

WindHawk 是由 RaMMicHaeL (m417z) 开发的“模块化代码注入式 Windows 定制平台”。简单来说可以通过下 Mod（当然也可以写 Mod）来注入式地修改系统，比如把资源管理器变成亚克力的，把开始菜单改回 Win7 的，诸如此类。

m417z 是著名的 [7+ Taskbar Tweaker (7TT)](https://ramensoftware.com/7-taskbar-tweaker) 软件的作者。实际上 7TT 在 Win11 上已经不被支持，WindHawk 正是官网声明的精神续作。大部分的 7TT 的功能都有对应的 m417z 亲自写的 WindHawk Mod。

{% endhideToggle %}

## 桌面
动态壁纸是 [这个](https://steamcommunity.com/sharedfiles/filedetails/?id=3776452884)，加上了“翡翠”的“图片筛选器”（大概就是滤镜的意思），拉满，然后把亮度和饱和度拉低以适应主题。但比较耗电，所以在 Wallpaper Engine 里面设置了离电时关闭。

这个时候背景就变成了 EverForest 里面最深一档的纯色背景。

我的桌面完全用来放杂乱的临时文件，App 都是用开始菜单或者 Launcher 打开的。在 WindHawk 里装了一个叫做 `Desktop Icons Double-Click Toggle` 的 Mod，以实现双击桌面切换桌面图标的显示；然后让 Agent 改了一下，开机的时候自动隐藏，这样就不会影响我欣赏酒寄彩叶的盛世美颜了。

## 开始菜单 / 任务栏

使用了 WindHawk 中的两个 styler Mod。

除了画廊里的展示效果好像也没什么好说的（）

我任务栏一般开着居左加上尽量不合并，由于有 YASB 所以开了自动隐藏。开始菜单选网格。

## 窗口描边 / 透明化

窗口描边目前用的是 GlazeWM 自带的聚焦窗口描边，不过如果只是想要描边效果，更推荐 [Tacky Borders](https://github.com/luke-you/tacky-borders)。如果我记得没错的话后者是支持给开始菜单、QQ 都加上描边的，但是前者不支持给开始菜单描边（我现在是用 WindHawk 改开始菜单给加上了描边），且由于 QQ 在这个边缘贴靠收起的“经典模式”下和 GlazeWM 不是很兼容，所以 QQ 被设置为了不被 GlazeWM 接管，也就没有效果了。

透明化（应该是亚克力，你也可以选其它的效果，比如模糊或者 Win11 的那个云母）用了 `Translucent Windows` Mod，不过只用在了 YASB 上：YASB 似乎没有内置的透明支持？

很好的一点是打开系统的节能模式之后这些透明效果都会关闭。

## 状态栏

YASB (Yet Another Status Bar)。

![](../images/d88a8ab739.png)

![各个组件展开的样子](../images/image.png)

现在用的是用 Agent 改过好多版的版本。不敢想没有 Agent 的话我需要花多少时间和代价才能做成这样...

而且即便如此，回想起这个调的过程，暑假刚开始的时候 DeepSeek Flash 还没有识图能力...依然是地狱啊。

总之最后做成了自己非常满意的样子。简单来说：

1. 大改了自带的 CPU / GPU / RAM / Battery 组件。统一把默认左键打开的显示状态波线图的窗口都去掉了，我的设计思路基本上是一个 HUD，平时根本就不会去点；右键显示的详细信息保留了，抬头就能看到电脑还有多久才会没电确实很好用。图标应该是从系统的字体和 JetBrains Mono 的字体里掏出来的。随着占用率 / 剩余电量的不同会有红橙黄的变化，默认情况下就是 EverForest 的米白色。不过似乎由于这个硬件比较新，暂时测不出温度？也不错，反正眼不见心不烦了。
2. 大改（感觉基本是重写）了自带的 WiFi 组件。
3. 音量组件似乎没怎么改？只记得把左键点出来的音量滑块关掉了（我没记错的话）

# 窗口管理器



# 应用启动器

# Pi Agent
决定另写一篇文章详细介绍。施工中。

# 后记

