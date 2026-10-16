/* ============================================================================
 * WooYun 的博客 —— 交互脚本
 * ----------------------------------------------------------------------------
 * 只对 DOM 做小改造，不修改主题源码（themes/butterfly/ 保持可升级）。
 * 引入方式：_config.butterfly.yml → inject.bottom
 * 配套样式：source/css/custom.css
 *
 * 现有功能：
 *   1. 侧栏作者名 → 包一层链接，指向自我介绍页
 *   2. 侧栏座右铭 → 点击展开 / 收起下半句
 *   3. 页脚左侧 → 插入二次元动图挂件（图不存在时静默隐藏） * ========================================================================= */

(function () {
  'use strict';

  /* 自我介绍页地址（source/about/index.md） */
  var ABOUT_URL = '/about/';

  /* 页脚左下角的二次元动图：把文件放到 source/img/ 下即可生效。
     换图、换路径只改这一行。
     当前图：1920×1080、84 帧、7.5MB 的原图，已用 ffmpeg 裁成人物特写并压成
     340×340 / 10fps 的动画 WebP（510KB，体积降到 7%）。 */
  var MASCOT_SRC = '/img/mascot.webp';

  /* 等元素出现：侧栏是服务端渲染的静态 DOM，但额外加一层保险，
     避免将来主题改成异步插入时失效。 */
  function whenReady(selector, callback, tries) {
    tries = tries === undefined ? 40 : tries;
    var el = document.querySelector(selector);
    if (el) return callback(el);
    if (tries > 0) {
      window.setTimeout(function () { whenReady(selector, callback, tries - 1); }, 100);
    }
  }

  /* ---- 1. 作者名变成链接（点击进入自我介绍页）-------------------------- */
  function linkAuthorName() {
    whenReady('#aside-content .card-info .author-info-name', function (name) {
      if (name.querySelector('a')) return;   // 已处理过

      var a = document.createElement('a');
      a.className = 'author-info-link';
      a.href = ABOUT_URL;
      a.title = '关于我';
      a.innerHTML = name.innerHTML;

      name.innerHTML = '';
      name.appendChild(a);
    });
  }

  /* ---- 2. 座右铭点击展开下半句 ----------------------------------------- */
  function initMotto() {
    whenReady('#aside-content .card-info .author-info-description', function (motto) {
      if (!motto.querySelector('.motto-extra')) return;   // 没配下半句就不管

      motto.setAttribute('role', 'button');
      motto.setAttribute('tabindex', '0');
      motto.setAttribute('title', '点击看看下半句');

      function toggle() {
        motto.classList.toggle('revealed');
      }

      motto.addEventListener('click', toggle);
      motto.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });
    });
  }

  /* ---- 3. 页脚左侧的二次元动图 ------------------------------------------ */
  /* 图片还没准备好（或路径写错）时自己消失，不会留下一个裂图框。 */
  function addFooterMascot() {
    whenReady('#footer', function (footer) {
      if (footer.querySelector('.footer-mascot')) return;   // 已处理过

      var img = document.createElement('img');
      img.className = 'footer-mascot';
      img.src = MASCOT_SRC;
      img.alt = '';
      img.loading = 'lazy';   /* 动图不跟着首屏一起抢带宽 */
      img.setAttribute('aria-hidden', 'true');
      img.addEventListener('error', function () { img.remove(); });

      footer.appendChild(img);
    });
  }

  /* ---- 入口 ------------------------------------------------------------- */
  function init() {
    linkAuthorName();
    initMotto();
    addFooterMascot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
