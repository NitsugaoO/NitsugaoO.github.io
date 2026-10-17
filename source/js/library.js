/* ============================================================================
 * 「文章库」页面 —— 文件树 + 文章列表
 * ----------------------------------------------------------------------------
 * 数据来自 /library.json（由 scripts/library-data.js 生成）。
 * 引入方式：_config.butterfly.yml → inject.bottom
 * 只在本页生效：找不到 #library-root 就直接返回。
 *
 * 交互：
 *   - 左侧树按分类层级展开，点击节点过滤右侧列表
 *   - 搜索框实时过滤（标题 / 简介 / 标签）
 *   - 右侧每篇文章带日期与可点击的标签
 *   - 支持从 URL 复原筛选状态：
 *       /library/?cat=数学分析/第一章&tag=笔记&q=极限
 *     （文章页的分类、标签链接就是指向这里的）
 *
 * 注意：列表项的外层是 <div> 而不是 <a> —— 因为标签本身是链接，
 *       HTML 不允许 <a> 套 <a>，浏览器会把内层链接撕出来导致布局错乱。
 * ========================================================================= */

(function () {
  'use strict';

  var root = document.getElementById('library-root');
  if (!root) return;   /* 不是文章库页面，什么都不做 */

  var DATA_URL = '/library.json';
  var HOME = '/library/';

  /* 标签配色：按标签名做哈希，保证同一个标签在任何地方颜色一致 */
  var TAG_COLORS = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple'];

  function tagColor(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) {
      h = (h * 31 + name.charCodeAt(i)) % 9973;
    }
    return TAG_COLORS[h % TAG_COLORS.length];
  }

  /* ---- DOM 小工具 -------------------------------------------------------- */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  /* ---- 按分类层级建树 ---------------------------------------------------- */
  function buildTree(posts) {
    var rootNode = { name: '', depth: -1, posts: [], children: [] };

    posts.forEach(function (post) {
      var node = rootNode;
      rootNode.posts.push(post);

      post.path.forEach(function (name) {
        var child = null;
        for (var i = 0; i < node.children.length; i++) {
          if (node.children[i].name === name) { child = node.children[i]; break; }
        }
        if (!child) {
          child = { name: name, depth: node.depth + 1, posts: [], children: [] };
          node.children.push(child);
        }
        child.posts.push(post);
        node = child;
      });
    });

    (function sortNode(n) {
      n.children.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh'); });
      n.children.forEach(sortNode);
    })(rootNode);

    return rootNode;
  }

  /* 文章是否属于某条分类路径（前缀匹配） */
  function inPath(post, path) {
    if (!path.length) return true;
    if (post.path.length < path.length) return false;
    for (var i = 0; i < path.length; i++) {
      if (post.path[i] !== path[i]) return false;
    }
    return true;
  }

  function samePath(a, b) {
    return a.join('\u0000') === b.join('\u0000');
  }

  /* ---- 渲染 -------------------------------------------------------------- */
  function render(posts) {
    var tree = buildTree(posts);

    /* 初始状态从 URL 复原（文章页的分类/标签链接会带参数过来） */
    var params = new URLSearchParams(window.location.search);
    var catParam = params.get('cat') || '';

    var state = {
      path: catParam ? catParam.split('/').filter(Boolean) : [],
      keyword: params.get('q') || '',
      tag: params.get('tag') || ''
    };

    root.innerHTML = '';

    /* --- 工具条 --- */
    var toolbar = el('div', 'library-toolbar');

    var searchWrap = el('div', 'library-search-wrap');
    var input = el('input', 'library-search');
    input.type = 'search';
    input.placeholder = '搜索标题、简介或标签…';
    input.setAttribute('aria-label', '搜索文章');
    input.value = state.keyword;
    searchWrap.appendChild(el('i', 'fas fa-search'));
    searchWrap.appendChild(input);

    var total = el('span', 'library-total');

    toolbar.appendChild(searchWrap);
    toolbar.appendChild(total);

    /* --- 筛选 chip（只在按标签筛选时出现）--- */
    var filters = el('div', 'library-filters');

    /* --- 主体 --- */
    var body = el('div', 'library-body');
    var treeBox = el('nav', 'library-tree');
    treeBox.setAttribute('aria-label', '分类导航');
    var listBox = el('div', 'library-list');

    body.appendChild(treeBox);
    body.appendChild(listBox);
    root.appendChild(toolbar);
    root.appendChild(filters);
    root.appendChild(body);

    /* ---- 地址栏同步（刷新/分享后仍停在当前筛选）---- */
    function syncUrl() {
      var p = new URLSearchParams();
      if (state.path.length && state.path[0] !== '__none__') p.set('cat', state.path.join('/'));
      if (state.tag) p.set('tag', state.tag);
      if (state.keyword.trim()) p.set('q', state.keyword.trim());

      var qs = p.toString();
      window.history.replaceState(null, '', qs ? HOME + '?' + qs : HOME);
    }

    /* ---- 分类树 ---- */
    function treeButton(label, path, count, isRoot, depth) {
      var btn = el('button', 'lib-node');
      btn.type = 'button';
      btn.style.paddingLeft = (12 + depth * 14) + 'px';
      btn.appendChild(el('i', isRoot ? 'fas fa-layer-group' : 'fas fa-folder'));
      btn.appendChild(el('span', 'lib-node-name', label));
      btn.appendChild(el('span', 'lib-node-count', String(count)));

      btn.addEventListener('click', function () {
        state.path = path;
        paintTree();
        paintList();
        syncUrl();
      });

      return btn;
    }

    function paintTree() {
      treeBox.innerHTML = '';

      var all = treeButton('全部文章', [], tree.posts.length, true, 0);
      if (!state.path.length) all.classList.add('is-active');
      treeBox.appendChild(all);

      (function walk(node, parentPath) {
        node.children.forEach(function (child) {
          var path = parentPath.concat(child.name);
          var btn = treeButton(child.name, path, child.posts.length, false, path.length);
          if (samePath(state.path, path)) btn.classList.add('is-active');
          treeBox.appendChild(btn);
          walk(child, path);
        });
      })(tree, []);

      /* 没有分类的文章单独给一个入口 */
      var orphans = tree.posts.filter(function (p) { return !p.path.length; });
      if (orphans.length) {
        var btn = treeButton('未分类', ['__none__'], orphans.length, false, 1);
        if (state.path[0] === '__none__') btn.classList.add('is-active');
        treeBox.appendChild(btn);
      }
    }

    /* ---- 标签筛选 chip ---- */
    function paintFilters() {
      filters.innerHTML = '';
      if (!state.tag) { filters.hidden = true; return; }

      filters.hidden = false;

      var chip = el('span', 'lib-chip');
      chip.appendChild(el('i', 'fas fa-tag'));
      chip.appendChild(document.createTextNode(' ' + state.tag + ' '));

      var close = el('button', 'lib-chip-close');
      close.type = 'button';
      close.title = '清除标签筛选';
      close.setAttribute('aria-label', '清除标签筛选');
      close.innerHTML = '<i class="fas fa-times"></i>';
      close.addEventListener('click', function () { applyTag(''); });
      chip.appendChild(close);

      filters.appendChild(chip);
    }

    function applyTag(name) {
      state.tag = name;
      paintFilters();
      paintList();
      syncUrl();
    }

    /* ---- 列表 ---- */
    function currentPosts() {
      var kw = state.keyword.trim().toLowerCase();

      return posts.filter(function (post) {
        /* 分类路径 */
        if (state.path[0] === '__none__') {
          if (post.path.length) return false;
        } else if (!inPath(post, state.path)) {
          return false;
        }

        /* 标签（精确匹配，不是模糊搜索） */
        if (state.tag && post.tags.indexOf(state.tag) === -1) return false;

        /* 关键词 */
        if (!kw) return true;
        var haystack = (post.title + ' ' + post.description + ' ' + post.tags.join(' ')).toLowerCase();
        return haystack.indexOf(kw) !== -1;
      });
    }

    function paintList() {
      var list = currentPosts();
      listBox.innerHTML = '';
      total.textContent = '共 ' + list.length + ' 篇';

      if (!list.length) {
        listBox.appendChild(el('p', 'library-empty', '没有符合条件的文章。'));
        return;
      }

      list.forEach(function (post) {
        var item = el('div', 'lib-item');

        /* 主体（标题 + 简介）本身是链接 */
        var main = el('a', 'lib-item-main');
        main.href = post.url;
        main.appendChild(el('div', 'lib-item-title', post.title || '（无标题）'));
        if (post.description) {
          main.appendChild(el('p', 'lib-item-desc', post.description));
        }

        /* 右侧：时间 + 标签 */
        var side = el('div', 'lib-item-side');
        var time = el('time', 'lib-item-date', post.date);
        time.dateTime = post.date;
        side.appendChild(time);

        if (post.tags.length) {
          var tags = el('div', 'lib-item-tags');
          post.tags.forEach(function (name) {
            var tagLink = document.createElement('a');
            tagLink.className = 'lib-tag tag-' + tagColor(name);
            tagLink.href = HOME + '?tag=' + encodeURIComponent(name);
            tagLink.textContent = name;
            tagLink.title = '只看「' + name + '」标签的文章';
            tagLink.addEventListener('click', function (e) {
              e.preventDefault();
              applyTag(name);
            });
            tags.appendChild(tagLink);
          });
          side.appendChild(tags);
        }

        item.appendChild(main);
        item.appendChild(side);
        listBox.appendChild(item);
      });
    }

    /* ---- 搜索（轻微防抖，打中文时不会每敲一下都重排）---- */
    var searchTimer = null;
    input.addEventListener('input', function () {
      if (searchTimer) window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(function () {
        state.keyword = input.value;
        paintList();
        syncUrl();
      }, 120);
    });

    paintTree();
    paintFilters();
    paintList();
  }

  /* ---- 载入 -------------------------------------------------------------- */
  window.fetch(DATA_URL)
    .then(function (res) {
      if (!res.ok) throw new Error(res.status);
      return res.json();
    })
    .then(render)
    .catch(function () {
      root.innerHTML = '<p class="library-error">文章索引加载失败，请刷新重试。</p>';
    });
})();
