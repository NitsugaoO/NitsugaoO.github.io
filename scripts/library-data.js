/* ============================================================================
 * 生成两份数据：
 *   /library.json  —— 只有文章/笔记（文章库页面用）
 *   /feed.json     —— 文章 + 笔记 + 说说，按时间倒序（首页中栏的时间流用）
 *
 * 为什么分开：文章库是"结构化浏览文章"，不能混进说说；
 * 首页要的是"所有内容的统一时间线"，两者用途不同。
 *
 * 说说来自 source/_data/shuoshuo.yml（site.data.shuoshuo）。
 * 放在站点根目录的 scripts/ 下，Hexo 自动加载。
 * ⚠️ 改完这个文件必须重启 hexo server（scripts 只在进程启动时加载）。
 * ========================================================================= */

'use strict';

/* HTML → 纯文本：文章库的「搜正文」要用。
   不引 hexo-util（pnpm 下站点根拿不到），手写足够用。 */
function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function postEntry(post) {
  return {
    kind: post.type === 'note' ? 'note' : 'post',
    /* 置顶：front-matter 的 top: true 或 sticky > 0 */
    top: !!(post.top || post.sticky > 0),
    title: post.title,
    url: '/' + post.path,
    date: post.date.format('YYYY-MM-DD'),
    /* 最后修改：scripts/updated-from-git.js 用 git 提交时间填的，
       没提交过的文件会回退成 date */
    updated: (post.updated || post.date).format('YYYY-MM-DD'),
    ts: post.date.valueOf(),
    cover: post.cover || '',
    description: post.description || '',
    path: post.categories.toArray().map(function (cat) { return cat.name; }),
    tags: post.tags.toArray().map(function (tag) { return tag.name; })
  };
}

hexo.extend.generator.register('library_and_feed', function (locals) {
  var published = locals.posts.filter(function (post) {
    return post.published !== false;
  });

  /* ---- library.json：只要文章 / 笔记 ---- */
  var library = published
    .sort('-date')
    .map(function (post) {
      var entry = postEntry(post);
      entry.type = post.type || 'post';   // 文章库历史上用的是 type 字段
      entry.text = stripHtml(post.content);   // 供文章库的「搜正文」使用
      return entry;
    });

  /* ---- feed.json：再加上说说 ---- */
  var feed = published.map(postEntry);

  (locals.data.shuoshuo || []).forEach(function (item) {
    var dateStr = String(item.date || '');
    feed.push({
      kind: 'shuoshuo',
      /* YAML 里的日期会被解析成 Date，String() 后是 ISO 格式，
         这里统一成 "YYYY-MM-DD HH:mm" 好看一些 */
      date: dateStr.slice(0, 16).replace('T', ' '),
      ts: Date.parse(dateStr) || 0,
      /* 说说正文要渲染成 HTML：支持 Markdown、图片、Hexo 标签 */
      html: hexo.render.renderSync({ text: item.content || '', engine: 'markdown' }),
      tags: item.tags || []
    });
  });

  /* 置顶的排最前，其余按时间倒序 */
  feed.sort(function (a, b) {
    if (!!a.top !== !!b.top) return a.top ? -1 : 1;
    return b.ts - a.ts;
  });

  return [
    { path: 'library.json', data: JSON.stringify(library) },
    { path: 'feed.json', data: JSON.stringify(feed) }
  ];
});
