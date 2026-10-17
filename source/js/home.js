/* ============================================================================
 * 首页 —— 「左列表 + 中预览」的主从视图
 * ----------------------------------------------------------------------------
 * 数据来自 /library.json（scripts/library-data.js 生成）。
 * 只在首页生效：找得到 #recent-posts、且不是文章库页面时才接管。
 *
 * 行为：
 *   - 左列顶部：作者卡（点击 = 回到中间的自我介绍）
 *   - 左列：按时间倒序的文章小卡片
 *   - 中列：默认自我介绍；选中文章后显示标题 / 时间 / 分类 / 标签 / 简介
 *           + 「阅读全文」按钮
 *   - 窄屏：不再分栏，点卡片直接进文章（预览在这个尺寸下没意义）
 *
 * 侧栏的「最新文章」卡片已关掉（card_recent_post.enable = false），
 * 作者卡在首页隐藏（避免和左列顶部那张重复），文章页不受影响。
 * ========================================================================= */

(function () {
  'use strict';

  var mount = document.getElementById('recent-posts');
  if (!mount) return;                                   /* 不是首页 */
  if (document.getElementById('library-root')) return;  /* 文章库页面，别抢 */

  var DATA_URL = '/library.json';
  var AVATAR = '/img/cloud.jpg';
  var ABOUT_URL = '/about/';

  /* 给 body 打个标记：首页专用样式（如三栏间距）靠它生效 */
  document.body.classList.add('home-mode');

  /* 窄屏阈值：低于这个宽度就不做主从视图了 */
  var NARROW = 900;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function isNarrow() {
    return window.matchMedia('(max-width: ' + NARROW + 'px)').matches;
  }

  /* ---- 默认面板：自我介绍 ------------------------------------------------- */
  function introPanel() {
    var box = el('div', 'home-intro');

    var avatar = el('img', 'home-intro-avatar');
    avatar.src = AVATAR;
    avatar.alt = '';
    avatar.loading = 'lazy';

    box.appendChild(avatar);
    box.appendChild(el('div', 'home-intro-name', '呜云 WooYun'));
    box.appendChild(el('p', 'home-intro-motto', '你内心一定有着某种火焰，把你与其他人区别开来。'));
    box.appendChild(el('p', 'home-intro-text',
      '这里放着 CTF 题解、基础课笔记，以及折腾过的工具与环境。' +
      '按左边的时间顺序挑一篇，或者直接去文章库检索。'));

    var links = el('div', 'home-intro-links');

    var toAbout = el('a', 'home-intro-btn', '关于我');
    toAbout.href = '/about/';

    var toLib = el('a', 'home-intro-btn home-intro-btn--ghost', '浏览文章库');
    toLib.href = '/library/';

    var toGh = el('a', 'home-intro-btn home-intro-btn--ghost', 'GitHub');
    toGh.href = 'https://github.com/NitsugaoO';
    toGh.target = '_blank';
    toGh.rel = 'noopener';

    links.appendChild(toAbout);
    links.appendChild(toLib);
    links.appendChild(toGh);
    box.appendChild(links);

    return box;
  }

  /* ---- 文章预览面板 ------------------------------------------------------ */
  function postPanel(post) {
    var box = el('article', 'home-preview-body');

    box.appendChild(el('h2', 'home-preview-title', post.title || '（无标题）'));

    var meta = el('div', 'home-preview-meta');
    meta.appendChild(el('time', 'home-preview-date', post.date));
    if (post.path.length) {
      meta.appendChild(el('span', 'home-preview-dot', '·'));
      meta.appendChild(el('span', 'home-preview-cat', post.path.join(' / ')));
    }
    box.appendChild(meta);

    if (post.tags.length) {
      var tags = el('div', 'home-preview-tags');
      post.tags.forEach(function (name) {
        var t = el('span', 'home-preview-tag', name);
        t.addEventListener('click', function () {
          window.location.href = '/library/?tag=' + encodeURIComponent(name);
        });
        tags.appendChild(t);
      });
      box.appendChild(tags);
    }

    if (post.description) {
      box.appendChild(el('p', 'home-preview-desc', post.description));
    }

    var btn = el('a', 'home-preview-btn');
    btn.href = post.url;
    btn.innerHTML = '阅读全文 <i class="fas fa-arrow-right"></i>';
    box.appendChild(btn);

    return box;
  }

  /* ---- 主渲染 ------------------------------------------------------------ */
  function render(posts) {
    if (!posts.length) return;

    mount.innerHTML = '';
    mount.classList.add('home-split');

    /* ---- 左列 ---- */
    var list = el('nav', 'home-list');
    list.setAttribute('aria-label', '文章列表');

    /* 作者卡：点击把中列切回自我介绍 */
    var authorBtn = el('button', 'home-author is-active');
    authorBtn.type = 'button';

    var avatar = el('img', 'home-author-avatar');
    avatar.src = AVATAR;
    avatar.alt = '';
    avatar.loading = 'lazy';

    authorBtn.appendChild(avatar);
    authorBtn.appendChild(el('span', 'home-author-name', '呜云 WooYun'));
    authorBtn.appendChild(el('span', 'home-author-hint', '关于'));
    list.appendChild(authorBtn);

    /* ---- 中列 ---- */
    var preview  = el('div', 'home-preview');
    var panel = introPanel();
    preview.appendChild(panel);

    var items = [];
    var selected = -1;   /* -1 = 没选，显示自我介绍 */

    /* 统一的选择逻辑：-1 表示回到自我介绍 */
    function select(index) {
      selected = index;

      authorBtn.classList.toggle('is-active', index === -1);
      items.forEach(function (btn, i) {
        btn.classList.toggle('is-active', i === index);
      });

      panel.remove();
      panel = index === -1 ? introPanel() : postPanel(posts[index]);
      preview.appendChild(panel);
      preview.scrollTop = 0;
    }

    authorBtn.addEventListener('click', function () {
      /* 窄屏下预览窗格是隐藏的，切回自我介绍也没东西可看，直接去关于页 */
      if (isNarrow()) {
        window.location.href = ABOUT_URL;
        return;
      }
      select(-1);
    });

    posts.forEach(function (post, index) {
      var item = el('button', 'home-item');
      item.type = 'button';

      item.appendChild(el('time', 'home-item-date', post.date));
      item.appendChild(el('span', 'home-item-title', post.title || '（无标题）'));

      var metaText = post.path.length ? post.path.join(' / ') : '未分类';
      if (post.tags.length) metaText += '　' + post.tags.join(' · ');
      item.appendChild(el('span', 'home-item-meta', metaText));

      item.addEventListener('click', function () {
        /* 窄屏：预览没意义，直接进文章 */
        if (isNarrow()) {
          window.location.href = post.url;
          return;
        }
        select(index);
      });

      items.push(item);
      list.appendChild(item);
    });

    mount.appendChild(list);
    mount.appendChild(preview);

    /* 首页隐藏侧栏的作者卡：同一张脸在左列顶部已经出现过一次。
       （只动首页；文章页的侧栏作者卡和座右铭都不受影响） */
    var asideInfo = document.querySelector('#aside-content .card-info');
    if (asideInfo) asideInfo.style.display = 'none';

    /* 首页原来的分页器用不上了（左列已经列出全部文章） */
    var pager = document.querySelector('#content-inner .pagination');
    if (pager) pager.style.display = 'none';
  }

  /* ---- 载入 -------------------------------------------------------------- */
  window.fetch(DATA_URL)
    .then(function (res) {
      if (!res.ok) throw new Error(res.status);
      return res.json();
    })
    .then(render)
    .catch(function () {
      /* 拿不到数据就别动，保留主题原有的文章卡片流 */
    });
})();
