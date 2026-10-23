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

hexo.extend.generator.register('site_data', function (locals) {
  var site = locals.data.site || {};

  return {
    path: 'site.json',
    data: JSON.stringify({
      announcement: site.announcement || ''
    })
  };
});
