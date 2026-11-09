/* ============================================================================
 * 正文图片的「列表缩略图 + 图片段落分组」
 * ----------------------------------------------------------------------------
 * 两件事，都在 HTML 渲染之后做（Markdown 源文改不了结构）：
 *
 * 1. 缩略图
 *    原图是手机原图（3072×4096，最大 6144×8192 / 17 MB）。列表页把它们塞进
 *    100~300px 的格子，浏览器却要下载全尺寸、按原分辨率解码 —— 一条 9 张图
 *    的说说 = 61 MB / 约 5 亿像素，滚动必卡。这里把列表里的 <img src> 换成
 *    tools/make-thumbs.py 生成的 source/images/thumbs/*.webp（长边 1000），
 *    外层 <a href> 指向原图，点开仍是清晰大图。
 *    缩略图不存在（小图、新加还没跑脚本）→ 自动回退原图，不会坏。
 *
 * 2. 段落分组
 *    「一个 <p> 里只有图片和 <br>」的段落会被加 class：
 *        <p class="ph-imgs ph-imgs--3">   ← 3 张
 *    CSS 只按这个 class 排版，不再用 `p:has(> a:nth-of-type(2) > img)` 去猜。
 *    好处：① 混排「文字 + 一张图」的段落不会被误当成图片行（旧的 :has 规则
 *    分不出来）；② 张数分档（1/2/3/4/5+）在渲染期就算好，CSS 干净。
 *
 *    可选显式覆盖：rewriteImages(html, { layout: 'grid2' }) —— 说说 YAML 的
 *    layout 字段走这条，跳过自动分档。
 *
 * 注意：img-path.js（before_post_render）只改 Markdown 源文里的路径，
 *       拿不到渲染后的结构，所以这部分必须放在 after_post_render。
 *       feed.json 那条路径（scripts/library-data.js）不走过滤器，手动调
 *       rewriteImages()。
 *
 * ⚠️ 改完这个文件必须重启 hexo server（scripts 只在进程启动时加载）。
 * ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');

const LAYOUTS = {
  single: 'ph-imgs--1',
  grid1: 'ph-imgs--1',
  grid2: 'ph-imgs--2',
  grid3: 'ph-imgs--3',
  grid4: 'ph-imgs--4'
};

function baseDir() {
  return (typeof hexo !== 'undefined' && hexo.base_dir) || process.cwd();
}

/* /images/xxx.jpg → /images/thumbs/xxx.webp（文件不存在则返回 ''） */
function thumbOf(absSrc) {
  const m = /^\/images\/(.+)$/.exec(absSrc);
  if (!m || m[1].indexOf('thumbs/') === 0) return '';
  const rel = m[1].replace(/\.[^.\/]+$/, '.webp');
  const file = path.join(baseDir(), 'source', 'images', 'thumbs', rel);
  try {
    if (!fs.statSync(file).isFile()) return '';
  } catch (err) {
    return '';
  }
  return '/images/thumbs/' + rel;
}

/* Markdown 里写 ../images/x（VSCode 预览要看图），这里统一成站点绝对路径 */
function toAbsolute(src) {
  const s = String(src || '').trim();
  if (!s) return '';
  if (/^(?:https?:)?\/\//i.test(s) || s.indexOf('data:') === 0) return '';
  const abs = s.replace(/^\.\.\//, '/');
  return /^\/images\//.test(abs) ? abs : '';
}

function escapeAttr(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* 单个 <img> → 缩略图 src，再包一层灯箱链接（外层 a 的 href 是原图） */
function rewriteImgTag(tag) {
  if (/no-lightbox/i.test(tag)) return tag;

  const srcMatch = /(\ssrc\s*=\s*)(["'])([^"']*)\2/i.exec(tag);
  if (!srcMatch) return tag;

  const abs = toAbsolute(srcMatch[3]);
  if (!abs) return tag;

  const thumb = thumbOf(abs);
  let next = tag;
  if (thumb) {
    next = next.replace(srcMatch[0], srcMatch[1] + srcMatch[2] + thumb + srcMatch[2]);
  } else if (abs !== srcMatch[3]) {
    next = next.replace(srcMatch[0], srcMatch[1] + srcMatch[2] + abs + srcMatch[2]);
  }

  /* 原生懒加载：主题的 lazyload 是关的（_config.butterfly.yml:1029） */
  if (!/\bloading\s*=/i.test(next)) next = next.replace(/<img\b/i, '<img loading="lazy"');
  if (!/\bdecoding\s*=/i.test(next)) next = next.replace(/<img\b/i, '<img decoding="async"');

  const caption = (/alt\s*=\s*(["'])([^"']*)\1/i.exec(next) || [])[2] || '';
  return '<a href="' + abs + '" data-fancybox="gallery"'
    + (caption ? ' data-caption="' + escapeAttr(caption) + '"' : '')
    + '>' + next + '</a>';
}

/* 只换 src（归一化 + 缩略图），不包灯箱链接 —— 用在已经被用户包了 <a> 的图上 */
function rewriteImgSrc(tag) {
  if (/no-lightbox/i.test(tag)) return tag;
  const srcMatch = /(\ssrc\s*=\s*)(["'])([^"']*)\2/i.exec(tag);
  if (!srcMatch) return tag;
  const abs = toAbsolute(srcMatch[3]);
  if (!abs) return tag;
  const thumb = thumbOf(abs) || abs;
  return tag.replace(srcMatch[0], srcMatch[1] + srcMatch[2] + thumb + srcMatch[2]);
}

/* 一个 <p> 里除 img / br / a 外是否还有别的东西（文字、行内代码、链接文字…） */
function onlyImages(inner) {
  const rest = inner
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<\/?a\b[^>]*>/gi, '')
    .replace(/\s+/g, '');
  return rest === '';
}

function countImages(inner) {
  const m = inner.match(/<img\b[^>]*>/gi);
  return m ? m.length : 0;
}

function classForCount(n) {
  if (n <= 1) return 'ph-imgs--1';
  if (n === 2) return 'ph-imgs--2';
  if (n === 3) return 'ph-imgs--3';
  if (n === 4) return 'ph-imgs--4';
  return 'ph-imgs--many';
}

/**
 * @param {string} html   渲染后的 HTML
 * @param {object} [opts] { layout: 'single'|'grid2'|'grid3'|'grid4' } 显式覆盖
 * @returns {string}
 */
function rewriteImages(html, opts) {
  let out = String(html || '');
  if (out.indexOf('<img') === -1) return out;

  const override = LAYOUTS[String((opts && opts.layout) || '').toLowerCase()] || '';

  /* 已经包在 <a> 里的图片不动结构（用户手写的图片链接），
     但 src 仍然要归一化 + 换缩略图；先抽出来避免重复包 */
  const stashed = [];
  out = out.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, function (anchor) {
    if (anchor.indexOf('<img') === -1) return anchor;
    stashed.push(anchor.replace(/<img\b[^>]*>/gi, rewriteImgSrc));
    return '\u0001A' + (stashed.length - 1) + '\u0001';
  });

  out = out.replace(/<p(\s[^>]*)?>([\s\S]*?)<\/p>/g, function (whole, attrs, inner) {
    if (inner.indexOf('<img') === -1) return whole;

    const rewritten = inner.replace(/<img\b[^>]*>/gi, rewriteImgTag);

    /* 纯图片段落 → 加分组 class；混排段落只换图，不动布局 */
    const extra = onlyImages(rewritten)
      ? (override || classForCount(countImages(rewritten)))
      : '';

    if (!extra) return '<p' + (attrs || '') + '>' + rewritten + '</p>';
    if (attrs && /class\s*=/i.test(attrs)) {
      const merged = attrs.replace(
        /class\s*=\s*(["'])([^"']*)\1/i,
        'class="$2 ph-imgs ' + extra + '"'
      );
      return '<p' + merged + '>' + rewritten + '</p>';
    }
    return '<p' + (attrs || '') + ' class="ph-imgs ' + extra + '">' + rewritten + '</p>';
  });

  stashed.forEach(function (anchor, i) {
    out = out.replace('\u0001A' + i + '\u0001', anchor);
  });

  return out;
}

if (typeof hexo !== 'undefined' && hexo.extend) {
  hexo.extend.filter.register('after_post_render', function (data) {
    if (data && typeof data.content === 'string') {
      data.content = rewriteImages(data.content);
    }
    return data;
  });
}

module.exports = { rewriteImages, thumbOf, rewriteImgTag, classForCount, escapeAttr, toAbsolute };
