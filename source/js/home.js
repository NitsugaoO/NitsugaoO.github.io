/* ============================================================================
 * 首页 —— 「左侧筛选 + 中栏时间流」
 * ----------------------------------------------------------------------------
 * 数据来自 /feed.json（scripts/library-data.js 生成）：
 *   文章 / 笔记 / 说说 三种条目混在一起，按时间倒序。
 *
 * 左列：作者卡（点击进 /about/）+ 四个筛选项（全部 / 文章 / 笔记 / 说说）
 * 中栏：时间流，每条按 kind 渲染成不同的卡片
 * 右列：主题侧栏（作者卡在首页隐藏，避免和左列重复）
 *
 * 只在首页生效：找不到 #recent-posts、或是文章库页面时直接返回。
 * ========================================================================= */

(function () {
  'use strict';

  var mount = document.getElementById('recent-posts');
  if (!mount) return;                                   /* 不是首页 */
  if (document.getElementById('library-root')) return;  /* 文章库页面 */

  var DATA_URL = '/feed.json';
  var SITE_URL = '/site.json';
  var AVATAR = '/img/cloud.jpg';
  var ABOUT_URL = '/about/';

  /* 给 body 打标记：首页专用样式靠它生效（注意选择器要写 body.home-mode） */
  document.body.classList.add('home-mode');

  /* 公告板文案从 /site.json 读（source/_data/site.yml），管理页可以直接改，
     不再硬编码在这里。 */
  var ANNOUNCEMENT = '';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  /* 标签小徽章 */
  function tagList(tags) {
    if (!tags || !tags.length) return null;
    var box = el('div', 'feed-tags');
    tags.forEach(function (name) {
      var a = document.createElement('a');
      a.className = 'feed-tag';
      a.href = '/library/?tag=' + encodeURIComponent(name);
      a.textContent = name;
      box.appendChild(a);
    });
    return box;
  }

  /* ---- 说说卡片 ---------------------------------------------------------- */
  function shuoshuoCard(item) {
    var card = el('article', 'feed-item feed-shuoshuo');

    var head = el('header', 'feed-head');
    var avatar = el('img', 'feed-avatar');
    avatar.src = AVATAR;
    avatar.alt = '';
    avatar.loading = 'lazy';
    head.appendChild(avatar);
    head.appendChild(el('span', 'feed-name', 'WooYun'));
    head.appendChild(el('time', 'feed-date', item.date));
    card.appendChild(head);

    /* html 是服务端渲染好的 Markdown，直接用 */
    var body = el('div', 'feed-body');
    body.innerHTML = item.html || '';
    card.appendChild(body);

    var tags = tagList(item.tags);
    if (tags) card.appendChild(tags);

    return card;
  }

  /* ---- 文章 / 笔记卡片 --------------------------------------------------- */
  function postCard(item) {
    var card = el('article', 'feed-item feed-post');

    var head = el('header', 'feed-head');
    /* 置顶标记：feed.json 里已按 top 排到最前，这里补一个可见的徽章，
       否则流里看不出哪篇是置顶的（左栏的置顶卡片只在侧边栏）。 */
    if (item.top) {
      var pin = el('span', 'feed-kind feed-kind--pin');
      pin.appendChild(el('i', 'fas fa-thumbtack'));
      pin.appendChild(document.createTextNode(' 置顶'));
      head.appendChild(pin);
    }
    head.appendChild(el('span', 'feed-kind feed-kind--' + item.kind,
      item.kind === 'note' ? '笔记' : '文章'));
    var dateText = item.date || '';
    if (item.updated && item.updated !== item.date) dateText += ' · 更新 ' + item.updated;
    head.appendChild(el('time', 'feed-date', dateText));
    card.appendChild(head);

    var title = el('h3', 'feed-title');
    var link = document.createElement('a');
    link.href = item.url;
    link.textContent = item.title || '（无标题）';
    title.appendChild(link);
    card.appendChild(title);

    if (item.description) {
      card.appendChild(el('p', 'feed-desc', item.description));
    }

    /* 封面缩略图（只有设了 cover 的文章才有） */
    if (item.cover) {
      var thumb = el('a', 'feed-thumb');
      thumb.href = item.url;
      var img = el('img');
      img.src = item.cover;
      img.alt = '';
      img.loading = 'lazy';
      thumb.appendChild(img);
      card.appendChild(thumb);
    }

    var tags = tagList(item.tags);
    if (tags) card.appendChild(tags);

    return card;
  }

  /* 图片点击放大：主题只在页面加载时遍历一次图片并包上 <a data-fancybox>，
     而我们的卡片是 fetch 之后才插进去的，赶不上那一趟，所以每次重绘后
     手动调一次主题的 loadLightbox。 */
  function bindLightbox(container) {
    if (!window.btf || typeof window.btf.loadLightbox !== 'function') return;
    var imgs = container.querySelectorAll('img:not(.no-lightbox)');
    if (imgs.length) window.btf.loadLightbox(imgs);
  }

  /* ---- 渲染 -------------------------------------------------------------- */
  function render(items) {
    if (!items.length) return;

    var state = { filter: 'all' };

    mount.innerHTML = '';
    mount.classList.add('home-split');

    /* ===== 左列 ===== */
    var side = el('nav', 'home-side');

    /* 把侧栏那张作者卡（大圆头像 + 名字 + 座右铭 + 文章/标签/分类统计）
       整张搬到左列顶部：直接移动 DOM 而不是重建，这样主题的样式和
       custom.js 已经绑好的交互（名字点击 → 关于页、座右铭点击展开）都能复用。 */
    var asideInfo = document.querySelector('#aside-content .card-info');
    if (asideInfo) side.appendChild(asideInfo);

    /* ---- 公告板（留空则不渲染）---- */
    if (ANNOUNCEMENT) {
      var board = el('div', 'home-board');
      var boardHead = el('div', 'home-board-title');
      boardHead.appendChild(el('i', 'fas fa-bullhorn'));
      boardHead.appendChild(document.createTextNode(' 公告'));
      board.appendChild(boardHead);
      board.appendChild(el('p', 'home-board-text', ANNOUNCEMENT));
      side.appendChild(board);
    }

    /* ---- 置顶文章：接在公告下面，沿用旧的文章小卡片样式 ---- */
    var pinned = items.filter(function (it) { return it.top; });
    if (pinned.length) {
      var pinBox = el('div', 'home-pins');

      var pinHead = el('div', 'home-pins-title');
      pinHead.appendChild(el('i', 'fas fa-thumbtack'));
      pinHead.appendChild(document.createTextNode(' 置顶'));
      pinBox.appendChild(pinHead);

      pinned.forEach(function (it) {
        var a = document.createElement('a');
        a.className = 'home-item';
        a.href = it.url;

        a.appendChild(el('time', 'home-item-date', it.date));
        a.appendChild(el('span', 'home-item-title', it.title || '（无标题）'));

        var metaText = it.path && it.path.length ? it.path.join(' / ') : '未分类';
        if (it.tags && it.tags.length) metaText += '　' + it.tags.join(' · ');
        a.appendChild(el('span', 'home-item-meta', metaText));

        pinBox.appendChild(a);
      });

      side.appendChild(pinBox);
    }

    /* ---- 筛选：带条数（放在中栏顶部）---- */
    var filters = el('div', 'home-filters');
    var filterDefs = [
      { key: 'all', label: '全部' },
      { key: 'post', label: '文章' },
      { key: 'note', label: '笔记' },
      { key: 'shuoshuo', label: '说说' }
    ];
    var filterBtns = {};

    filterDefs.forEach(function (def) {
      var count = def.key === 'all'
        ? items.length
        : items.filter(function (it) { return it.kind === def.key; }).length;
      if (!count) return;   /* 没内容的分类不占位 */

      var btn = el('button', 'home-filter');
      btn.type = 'button';
      btn.appendChild(document.createTextNode(def.label));
      btn.appendChild(el('span', 'home-filter-count', String(count)));
      if (def.key === 'all') btn.classList.add('is-active');

      btn.addEventListener('click', function () {
        state.filter = def.key;
        Object.keys(filterBtns).forEach(function (k) {
          filterBtns[k].classList.toggle('is-active', k === def.key);
        });
        paintFeed();
      });

      filterBtns[def.key] = btn;
      filters.appendChild(btn);
    });

    side.appendChild(filters);

    /* 注：搜索框 / 分类入口 / 底部快捷链接已按用户要求移除，
       只保留「作者卡 + 公告板 + 筛选」。 */

    /* ===== 中栏 ===== */
    var feed = el('div', 'home-feed');

    function paintFeed() {
      feed.innerHTML = '';

      var list = items.filter(function (item) {
        return state.filter === 'all' || item.kind === state.filter;
      });

      if (!list.length) {
        feed.appendChild(el('p', 'home-empty', '这一类还没有内容。'));
        return;
      }

      list.forEach(function (item) {
        feed.appendChild(item.kind === 'shuoshuo' ? shuoshuoCard(item) : postCard(item));
      });

      bindLightbox(feed);
    }

    mount.appendChild(side);

    /* 中栏：筛选条放最上面（它控制的就是下面这个流），再是时间流 */
    var main = el('div', 'home-main');
    main.appendChild(filters);
    main.appendChild(feed);
    mount.appendChild(main);

    /* 原来的分页器用不上了 */
    var pager = document.querySelector('#content-inner .pagination');
    if (pager) pager.style.display = 'none';

    paintFeed();
  }

  /* ---- 载入 -------------------------------------------------------------- */
  function fetchJSON(url) {
    return window.fetch(url).then(function (res) {
      if (!res.ok) throw new Error(res.status);
      return res.json();
    });
  }

  /* 两个数据源并行拉：feed 必填，site 失败时退化成没有公告。
     正常情况下 window.__homeData 已经在 <head> 里发起过了（见
     _config.butterfly.yml 的 inject.head），这里直接复用那个 promise，
     省掉一次往返；只有它不存在时（比如脚本被单独引用）才自己拉。 */
  var boot = window.__homeData || Promise.all([
    fetchJSON(DATA_URL),
    fetchJSON(SITE_URL).catch(function () { return {}; })
  ]);

  boot
    .then(function (result) {
      ANNOUNCEMENT = result[1].announcement || '';
      render(result[0]);
      /* 三栏已经出来了，防闪烁的隐藏标记没必要再留着 */
      document.documentElement.classList.remove('home-pending');
    })
    .catch(function () {
      /* 拿不到数据就别动，保留主题原有的卡片流；顺手撤掉防闪烁的隐藏，
         否则旧的卡片流还被藏着，要等 <head> 里那个 4 秒兜底才出来 */
      document.documentElement.classList.remove('home-pending');
    });
})();
