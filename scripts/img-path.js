/* ============================================================================
 * 文章里的图片路径：md 里写相对路径，渲染时改回站点绝对路径
 * ──────────────────────────────────────────────────────────────────────────
 * 为什么要有这个东西：
 *   VSCode 的 Markdown 预览把 `/images/x.png` 当成**磁盘根**（file:///images/…），
 *   而它只认「相对当前 .md 文件」的路径 → 在 VSCode 里文章图片全是裂的。
 *   站内图片都在 source/images/，文章都在 source/_posts/，所以 md 里写：
 *       ![](../images/x.png)
 *     · VSCode 预览 / 管理页预览（markdown-it 直接渲染）→ 能正常显示
 *     · Hexo 渲染出的 HTML → 由这里改回 `/images/x.png`，线上路径不变
 *
 * 改写的写法：Markdown 图片 / 链接、裸 <img src>、{% inlineImg ../img/x %} 的标签参数、
 *             裸 <video|audio|source src> 与 <video poster>（视频放 source/videos/，
 *             单个文件必须 ≤ 25 MiB —— 超了 Cloudflare Workers 部署会整体失败）。
 * 跳过三种区域：fenced 代码块、{% raw %}…{% endraw %}、行内代码 ——
 * 那些是「演示给人看的写法」，改了会把示例弄错。
 *
 * front-matter 的 cover 不经过这里，必须写 `/images/…` 绝对路径。
 *
 * ⚠️ 改完这个文件必须重启 hexo server（scripts 只在进程启动时加载）。
 * ========================================================================= */

'use strict';

/* 不参与改写的区域。注意 split 的分隔符里若有捕获组，捕获内容会留在结果数组里。 */
const SKIP = /(```[\s\S]*?```|~~~[\s\S]*?~~~|\{%-?\s*raw\s*-?%\}[\s\S]*?\{%-?\s*endraw\s*-?%\}|`[^`\n]*`)/;

function toAbsolute(segment) {
  return segment
    /* Markdown 写法：![](../images/x.png) / [文字](../images/x.png) */
    .replace(/(\]\()\.\.\/(images|img)\//g, '$1/$2/')
    /* 裸 HTML 写法：<img src="../images/x.png"> */
    .replace(/(<img[^>]*\ssrc=["'])\.\.\/(images|img)\//gi, '$1/$2/')
    /* 主题标签：{% inlineImg ../img/x.jpg 80px %} */
    .replace(/(\{%\s*inlineImg\s+)\.\.\/(images|img)\//g, '$1/$2/')
    /* 裸 HTML 视频 / 音频：<video src="../videos/x.mp4">、<source src="…"> */
    .replace(/(<(?:video|audio|source)[^>]*\ssrc=["'])\.\.\/(videos|images|img)\//gi, '$1/$2/')
    /* 视频封面：<video poster="../images/x.jpg"> */
    .replace(/(<(?:video|audio)[^>]*\sposter=["'])\.\.\/(images|img)\//gi, '$1/$2/')
    /* Markdown 链接（下载 / 外链）：[下载](../videos/x.mp4) */
    .replace(/(\]\()\.\.\/(videos)\//g, '$1/$2/');
}

hexo.extend.filter.register('before_post_render', function (data) {
  const body = data && data.content;
  if (!body || body.indexOf('../') === -1) return data;

  /* split 带捕获组：偶数下标是普通正文，奇数下标是被跳过的区域 */
  const parts = body.split(SKIP);
  for (let i = 0; i < parts.length; i += 2) parts[i] = toAbsolute(parts[i]);

  data.content = parts.join('');
  return data;
}, 9);
