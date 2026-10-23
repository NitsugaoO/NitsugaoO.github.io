/* ============================================================================
 * 自定义代码块语言 —— 让 ```flag 显示成 FLAG，而不是 PLAINTEXT
 * ----------------------------------------------------------------------------
 * 问题：Hexo 的高亮器（hexo-util → highlight.js）在渲染时判断语言，
 *       遇到不认识的就把 lang 直接改写成 'plaintext'
 *       （见 hexo-util/dist/highlight.js：`if (!lang || (!alias.aliases[lang]
 *       && !hljs.getLanguage(lang))) lang = 'plaintext'`），
 *       原始名字从此丢失，前端再改也拿不回来。
 *
 * 做法：给 highlight.js 注册一个"空语言"。它不做任何着色，但
 *       hljs.getLanguage('flag') 从此为真 → Hexo 保留原名 →
 *       <figure class="highlight flag"> → Butterfly 的语言标签显示 FLAG。
 *
 * 想加别的自定义语言，往 CUSTOM_LANGS 里加即可。
 * ⚠️ 别把真正的语言（js/python…）写进去，那些要交给 highlight.js 正常上色。
 *
 * ⚠️ 改完这个文件必须重启 hexo server：scripts/ 只在进程启动时加载一次。
 * ========================================================================= */

'use strict';

const path = require('path');

/* 拿到 hexo-util 内部实际使用的那个 highlight.js 实例。
   pnpm 下站点根通常没有 highlight.js（它藏在 .pnpm 里），
   所以从 hexo-util 的位置去解析 —— 解析到同一个真实路径，
   Node 的模块缓存会返回同一个实例，注册才会被 hexo-util 看到。 */
function loadHighlightJs() {
  try {
    return require('highlight.js');
  } catch (err) {
    const hexoDir = path.dirname(require.resolve('hexo/package.json'));
    const hexoUtilDir = path.dirname(require.resolve('hexo-util', { paths: [hexoDir] }));
    return require(require.resolve('highlight.js', { paths: [hexoUtilDir] }));
  }
}

const hljs = loadHighlightJs();

/* 自定义语言：不做任何着色，只为保住名字 */
const CUSTOM_LANGS = ['flag'];

CUSTOM_LANGS.forEach(function (name) {
  hljs.registerLanguage(name, function () {
    return { name: name, contains: [] };
  });
});
