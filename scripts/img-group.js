/* ============================================================================
 * 正文里的「连续图片行」→ 带缩略图的图片组
 * ----------------------------------------------------------------------------
 * Markdown 里这几行
 *
 *     ![](../images/a.jpg)
 *     ![](../images/b.jpg)
 *     ![](../images/c.jpg)
 *
 * 在 breaks:true 下会被渲染成「一个 <p> 里三张图 + 两个 <br>」。CSS 根本
 * 数不出这一段到底有几张 —— 旧的 `p:has(> img ~ img)` 只能笼统说「有 2 张
 * 以上」，也分不开「文字 + 一张图」的段落。这里在 Markdown 阶段就把它们
 * 换成一个现成的 HTML 块（html:true，markdown 会原样保留）：
 *
 *     <div class="ph-imgs ph-imgs--3">
 *     <a href="/images/a.jpg" data-fancybox="gallery"><img src="/images/thumbs/a.webp" …></a>
 *     …
 *     </div>
 *
 * 这样排版只认 .ph-imgs--N（1 / 2 / 3 / 4 / many），想改列数改 CSS 一处。
 * 同一张图的列表缩略图由 tools/make-thumbs.py 生成（长边 1000 webp），
 * 外层 <a> 指向原图，点开灯箱仍是清晰大图。
 *
 * 为什么挂在 before_post_render 而不是 before_generate
 * ---------------------------------------------------
 * 说说的正文有两条渲染路径：主题 /shuoshuo/ 页（helpers/page.js 的
 * shuoshuoFN 会把每条 content 过一遍 before_post_render）和首页 /feed.json
 * （scripts/library-data.js）。这两条都从 Markdown 出发，所以在这里改写
 * 一次就都覆盖了。
 *
 * before_generate 不行：hexo 的 _runGenerators() 在 before_generate 之后还会
 * locals.invalidate()，在内存里改 site.data 会被丢掉（踩过）。
 *
 * 显式覆盖列数：说说 YAML 加 `layout: grid2`（single/grid2/grid3/grid4），
 * 主题 helper 会把它塞进 mockPost.layout，这里读 data.layout。
 *
 * 代码块 / {% raw %} / 行内代码里的「图片行」是演示文字，跳过不改。
 *
 * ⚠️ 改完这个文件必须重启 hexo server（scripts 只在进程启动时加载）。
 * ========================================================================= */

'use strict';

const { thumbOf, classForCount, escapeAttr, toAbsolute } = require('./img-thumb.js');

/* 一整行只有一张 Markdown 图片：![](../images/x.jpg)、![说明](../images/x.jpg) */
const IMG_LINE = /^[ \t]*!\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+["'][^"']*["'])?\s*\)[ \t]*$/;

/* 不参与改写的区域（与 scripts/img-path.js 保持一致） */
const SKIP = /(```[\s\S]*?```|~~~[\s\S]*?~~~|\{%-?\s*raw\s*-?%\}[\s\S]*?\{%-?\s*endraw\s*-?%\}|`[^`\n]*`)/;

const LAYOUTS = {
  single: 'ph-imgs--1',
  grid1: 'ph-imgs--1',
  grid2: 'ph-imgs--2',
  grid3: 'ph-imgs--3',
  grid4: 'ph-imgs--4'
};

function imageGroup(images, cls) {
  const inner = images.map(function (img) {
    const caption = img.alt ? ' data-caption="' + escapeAttr(img.alt) + '"' : '';
    const alt = img.alt ? ' alt="' + escapeAttr(img.alt) + '"' : '';
    return '<a href="' + img.abs + '" data-fancybox="gallery"' + caption + '>'
      + '<img loading="lazy" decoding="async" src="' + (img.thumb || img.abs) + '"' + alt + '>'
      + '</a>';
  }).join('\n');

  return '<div class="ph-imgs ' + cls + '">\n' + inner + '\n</div>';
}

/* 把一段普通 Markdown 里连续的纯图片行换成图片组 HTML 块。
   HTML block 的结束条件是空行，所以 div 前后各留一个空行。 */
function groupImageLines(content, layout) {
  const lines = String(content || '').split('\n');
  const out = [];
  const override = LAYOUTS[String(layout || '').toLowerCase()] || '';

  let pending = [];

  function flush() {
    if (!pending.length) return;
    if (out.length && out[out.length - 1].trim() !== '') out.push('');
    out.push(imageGroup(pending, override || classForCount(pending.length)));
    out.push('');
    pending = [];
  }

  lines.forEach(function (line) {
    const m = IMG_LINE.exec(line);
    if (m) {
      const abs = toAbsolute(m[2]);
      if (abs) {
        pending.push({ alt: m[1], abs: abs, thumb: thumbOf(abs) });
        return;
      }
    }
    flush();
    out.push(line);
  });
  flush();

  return out.join('\n');
}

/* 跳过代码块等区域：split 带捕获组，偶数下标是普通正文 */
function groupSections(content, layout) {
  const parts = String(content || '').split(SKIP);
  for (let i = 0; i < parts.length; i += 2) {
    if (parts[i].indexOf('![') !== -1) parts[i] = groupImageLines(parts[i], layout);
  }
  return parts.join('');
}

if (typeof hexo !== 'undefined' && hexo.extend) {
  /* 优先级 10：跟在 scripts/img-path.js（9）后面，路径已经归一化过一遍 */
  hexo.extend.filter.register('before_post_render', function (data) {
    if (!data || typeof data.content !== 'string') return data;
    if (data.content.indexOf('![') === -1) return data;
    data.content = groupSections(data.content, data.layout);
    return data;
  }, 10);
}

module.exports = { groupImageLines, groupSections };
