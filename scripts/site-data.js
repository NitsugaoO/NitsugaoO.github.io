/* ============================================================================
 * 站点级文案 → /site.json
 * ----------------------------------------------------------------------------
 * 首页的公告板原本硬编码在 source/js/home.js 里，管理页（admin/）没法编辑。
 * 现在统一放到 source/_data/site.yml，由这个 generator 下发成静态 JSON，
 * 前端 fetch 一次即可。
 *
 * 为什么要单独一个 generator：
 *   - feed.json / library.json 是「内容索引」，site.json 是「站点配置」，
 *     生命周期不同，混在一起以后会越来越乱；
 *   - _data 里的内容前端拿不到，必须有一步生成。
 *
 * ⚠️ 改完这个文件必须重启 hexo server（scripts 只在进程启动时加载）。
 * ========================================================================= */

'use strict';

/* YAML 里写 added: 2026-10-23 会被解析成 Date，直接 JSON 化会变成
   "2026-10-23T00:00:00.000Z"。这里统一成日期字符串（用 UTC 分量，
   因为 js-yaml 按 UTC 零点解析）。 */
function dateOnly(value) {
  if (value instanceof Date) {
    function p(n) { return String(n).padStart(2, '0'); }
    return value.getUTCFullYear() + '-' + p(value.getUTCMonth() + 1) + '-' + p(value.getUTCDate());
  }
  return value ? String(value).slice(0, 10) : '';
}

hexo.extend.generator.register('site_data', function (locals) {
  var site = locals.data.site || {};
  var lyrics = (locals.data.lyrics || []).map(function (song) {
    return Object.assign({}, song, { added: dateOnly(song.added) });
  });

  return {
    path: 'site.json',
    data: JSON.stringify({
      announcement: site.announcement || '',
      /* 歌单（侧栏歌词卡）：来自 source/_data/lyrics.yml */
      lyrics: lyrics
    })
  };
});
