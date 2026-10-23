/* ============================================================================
 * 本地管理页（无框架，原生 DOM）
 * ----------------------------------------------------------------------------
 * 视图：文章 / 说说 / 友链 / 关于 / 公告
 * 数据全部通过 /api/* 读写，保存后提示「已保存」；
 * 「发布」= git add -A + commit + push（会自动触发两个平台部署）。
 * ========================================================================= */

(function () {
  'use strict';

  var state = {
    data: null,          /* 全部内容（/api/state） */
    view: 'posts',
    current: null,       /* 当前编辑的文章文件名 */
    currentDraft: false, /* 当前编辑的是不是 _drafts 里的草稿 */
    dirty: false
  };

  /* 视图可以直接用 /?view=shuoshuo 打开，切换时同步到地址栏（刷新不丢） */
  var VIEWS = ['posts', 'shuoshuo', 'lyrics', 'link', 'about', 'site'];
  var bootParams = new URLSearchParams(window.location.search);
  var initialView = bootParams.get('view');
  if (VIEWS.indexOf(initialView) !== -1) state.view = initialView;
  if (bootParams.get('file')) state.current = bootParams.get('file');
  state.currentDraft = bootParams.get('draft') === '1';

  function syncViewUrl() {
    var params = new URLSearchParams();
    if (state.view !== 'posts') params.set('view', state.view);
    if (state.view === 'posts' && state.current) params.set('file', state.current);
    if (state.view === 'posts' && state.currentDraft) params.set('draft', '1');
    var keep = new URLSearchParams(window.location.search);
    if (keep.get('preview') === '1') params.set('preview', '1');   /* 保留预览开关 */
    if (keep.get('fullscreen') === '1') params.set('fullscreen', '1');
    var qs = params.toString();
    window.history.replaceState(null, '', '/' + (qs ? '?' + qs : ''));
  }

  var app = document.getElementById('app');
  var statusEl = document.getElementById('status');
  var toastEl = document.getElementById('toast');

  /* ---- 通用 -------------------------------------------------------------- */

  function api(path, options) {
    options = options || {};
    return fetch(path, {
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : {},
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
        return data;
      });
    });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function toast(message, isError) {
    toastEl.textContent = message;
    toastEl.classList.toggle('is-error', !!isError);
    toastEl.classList.add('is-show');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(function () {
      toastEl.classList.remove('is-show');
    }, 2600);
  }

  function setDirty(value) {
    state.dirty = !!value;
    statusEl.textContent = state.dirty ? '有未保存的改动' : '';
    statusEl.classList.toggle('is-dirty', state.dirty);
  }

  function confirmLeave() {
    return !state.dirty || window.confirm('当前修改还没保存，确定离开吗？');
  }

  function parseList(value) {
    return String(value || '')
      .split(/[,，]/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  function joinList(value) {
    return Array.isArray(value) ? value.join(', ') : (value || '');
  }

  /* 图片字段的实时预览：输入框里改路径，旁边立刻显示图；
     图片不存在时用 .is-broken 半透明提示，不弹错。 */
  function makeImagePreview(getSrc) {
    var img = el('img', 'img-preview');
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('error', function () { img.classList.add('is-broken'); });
    img.addEventListener('load', function () { img.classList.remove('is-broken'); });

    function sync() {
      var src = String(getSrc() || '').trim();
      if (src) {
        if (img.getAttribute('src') !== src) {
          img.classList.remove('is-broken');
          img.src = src;
        }
        img.classList.add('is-open');
      } else {
        img.removeAttribute('src');
        img.classList.remove('is-open', 'is-broken');
      }
    }

    /* 点缩略图看大图（外部 URL 也支持） */
    img.addEventListener('click', function () {
      var src = img.getAttribute('src');
      if (src) openLightbox(src);
    });

    sync();
    return { el: img, sync: sync };
  }

  /* ---- 图片大图预览 ------------------------------------------------------ */

  function openLightbox(src) {
    if (!src) return;

    var overlay = el('div', 'lightbox');
    var img = el('img', 'lightbox-img');
    img.src = src;
    img.alt = '';

    var bar = el('div', 'lightbox-bar');
    bar.appendChild(el('span', 'lightbox-path', src));

    /* 站内图片才能用系统查看器打开（外部 URL 交给浏览器） */
    if (/^\/(images|img)\//.test(src)) {
      var openBtn = el('button', 'btn small', '用系统查看器打开');
      openBtn.type = 'button';
      openBtn.addEventListener('click', function () {
        api('/api/open-image', { method: 'POST', body: { src: src } })
          .then(function () { toast('已用系统查看器打开'); })
          .catch(function (err) { toast('打开失败：' + err.message, true); });
      });
      bar.appendChild(openBtn);
    }

    var closeBtn = el('button', 'btn small', '关闭');
    closeBtn.type = 'button';
    bar.appendChild(closeBtn);

    overlay.appendChild(img);
    overlay.appendChild(bar);
    document.body.appendChild(overlay);

    function close() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
    }

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', onKey);
  }

  /* ---- 文章 -------------------------------------------------------------- */

  function postSort(a, b) {
    return String(b.fm.date || '').localeCompare(String(a.fm.date || ''));
  }

  function renderPosts() {
    var posts = (state.data.posts || []).slice().sort(postSort);

    /* 当前文章用 file + currentDraft 两个字段定位（_posts / _drafts 可能同名） */
    var exists = posts.some(function (p) {
      return p.file === state.current && (p.status === 'draft') === !!state.currentDraft;
    });
    if (!exists) {
      state.current = null;
      state.currentDraft = false;
    }
    if (!state.current && posts.length) {
      state.current = posts[0].file;
      state.currentDraft = posts[0].status === 'draft';
    }

    app.innerHTML = '';
    var wrap = el('div', 'posts-wrap');

    /* --- 左列表 --- */
    var aside = el('aside', 'post-list');
    var head = el('div', 'list-head');
    head.appendChild(el('h2', null, '文章 / 笔记'));

    var addPost = el('button', 'btn small', '+ 文章');
    addPost.type = 'button';
    addPost.addEventListener('click', function () { createPost(false); });
    head.appendChild(addPost);

    var addDraft = el('button', 'btn small', '+ 草稿');
    addDraft.type = 'button';
    addDraft.addEventListener('click', function () { createPost(true); });
    head.appendChild(addDraft);

    aside.appendChild(head);

    var search = el('input', 'search');
    search.type = 'search';
    search.placeholder = '搜索标题、分类、标签…';
    aside.appendChild(search);

    /* 状态筛选：全部 / 已发布 / 草稿 */
    var filterBar = el('div', 'status-filter');
    var filter = 'all';
    [['all', '全部'], ['published', '已发布'], ['draft', '草稿']].forEach(function (pair) {
      var chip = el('button', 'status-chip' + (pair[0] === 'all' ? ' is-active' : ''), pair[1]);
      chip.type = 'button';
      chip.dataset.filter = pair[0];
      chip.addEventListener('click', function () {
        filter = pair[0];
        Array.prototype.forEach.call(filterBar.children, function (node) {
          node.classList.toggle('is-active', node === chip);
        });
        paintList(search.value);
      });
      filterBar.appendChild(chip);
    });
    aside.appendChild(filterBar);

    var listBox = el('div', 'list-items');
    aside.appendChild(listBox);

    function paintList(keyword) {
      var kw = String(keyword || '').toLowerCase();
      listBox.innerHTML = '';
      posts.filter(function (post) {
        if (filter !== 'all' && post.status !== filter) return false;
        if (!kw) return true;
        var fm = post.fm;
        var hay = [fm.title, joinList(fm.categories), joinList(fm.tags), fm.description].join(' ');
        return hay.toLowerCase().indexOf(kw) !== -1;
      }).forEach(function (post) {
        var isDraft = post.status === 'draft';
        var btn = el('button', 'list-item');
        btn.type = 'button';
        if (post.file === state.current && isDraft === !!state.currentDraft) {
          btn.classList.add('is-active');
        }

        var line = el('span', 'list-title');
        line.appendChild(el('i', isDraft ? 'post-status draft' : 'post-status published',
          isDraft ? '草稿' : '已发布'));
        if (post.fm.top) line.appendChild(el('i', 'pin', '置顶'));
        if (post.fm.type === 'note') line.appendChild(el('i', 'note', '笔记'));
        line.appendChild(document.createTextNode(post.fm.title || post.file));
        btn.appendChild(line);
        btn.appendChild(el('span', 'list-meta',
          [post.fm.date || '', joinList(post.fm.categories)].filter(Boolean).join(' · ')));

        btn.addEventListener('click', function () {
          if (!confirmLeave()) return;
          state.current = post.file;
          state.currentDraft = isDraft;
          paintList(search.value);
          renderEditor();
          syncViewUrl();
        });
        listBox.appendChild(btn);
      });
    }

    search.addEventListener('input', function () { paintList(search.value); });
    paintList('');

    var editor = el('section', 'editor');
    wrap.appendChild(aside);
    wrap.appendChild(editor);
    app.appendChild(wrap);

    function renderEditor() {
      var post = posts.filter(function (p) {
        return p.file === state.current && (p.status === 'draft') === !!state.currentDraft;
      })[0];
      if (!post) {
        editor.innerHTML = '<p class="empty">左边还没有文章，点「+ 文章」或「+ 草稿」开始。</p>';
        return;
      }
      buildEditor(editor, post);
    }

    renderEditor();
  }

  function buildEditor(container, post) {
    var fm = Object.assign({}, post.fm);
    var isDraft = post.status === 'draft';

    container.innerHTML = '';

    var head = el('div', 'editor-head');
    var titleBox = el('div', 'editor-title');
    titleBox.appendChild(el('h2', null, fm.title || post.file));
    titleBox.appendChild(el('span', 'status-badge ' + (isDraft ? 'draft' : 'published'),
      isDraft ? '草稿' : '已发布'));
    /* 两个时间分开展示：创建时间可编辑（在表单里），修改时间来自 git，只读 */
    titleBox.appendChild(el('span', 'editor-meta',
      '创建 ' + (fm.date || '未知') + ' · 更新 ' + (post.updated || fm.date || '未知')));
    head.appendChild(titleBox);

    var tools = el('div', 'editor-tools');

    var codeBtn = el('button', 'btn', 'VSCode');
    codeBtn.type = 'button';
    codeBtn.title = '在 VSCode 中打开这个文件';
    codeBtn.addEventListener('click', function () { openInVSCode(post); });
    tools.appendChild(codeBtn);

    var previewBtn = el('button', 'btn', '预览');
    previewBtn.type = 'button';
    previewBtn.addEventListener('click', function () { togglePreview(container); });
    tools.appendChild(previewBtn);

    var saveBtn = el('button', 'btn primary', '保存');
    saveBtn.type = 'button';
    saveBtn.addEventListener('click', function () { saveCurrentPost(container, post); });
    tools.appendChild(saveBtn);

    if (isDraft) {
      var publishBtn = el('button', 'btn primary', '转为已发布');
      publishBtn.type = 'button';
      publishBtn.title = '把文件从 _drafts 移到 _posts';
      publishBtn.addEventListener('click', function () { publishDraft(post); });
      tools.appendChild(publishBtn);
    }

    var delBtn = el('button', 'btn danger', '删除');
    delBtn.type = 'button';
    delBtn.addEventListener('click', function () { removePost(post); });
    tools.appendChild(delBtn);

    head.appendChild(tools);
    container.appendChild(head);

    /* 表单 */
    var grid = el('div', 'form-grid');

    function field(label, input, hint) {
      var box = el('label', 'field');
      box.appendChild(el('span', 'field-label', label));
      box.appendChild(input);
      if (hint) box.appendChild(el('span', 'field-hint', hint));
      return box;
    }

    /* 分类 / 标签：逗号分隔输入 + 现有值候选（点 chip 直接追加）。
       候选从所有文章汇总，避免「数学分析」和「数学分析 」被当成两个分类。 */
    function suggestField(label, value, fieldKey, hint) {
      var box = el('div', 'field');
      box.appendChild(el('span', 'field-label', label));

      var input = el('input');
      input.type = 'text';
      input.value = joinList(value);
      input.addEventListener('input', function () { setDirty(true); });
      box.appendChild(input);

      var seen = {};
      (state.data.posts || []).forEach(function (p) {
        var list = p.fm[fieldKey];
        if (Array.isArray(list)) {
          list.forEach(function (name) { seen[name] = true; });
        }
      });
      var candidates = Object.keys(seen).sort(function (a, b) {
        return a.localeCompare(b, 'zh');
      });

      if (candidates.length) {
        var chips = el('div', 'suggest');
        candidates.forEach(function (name) {
          var chip = el('button', 'suggest-chip', name);
          chip.type = 'button';
          chip.title = '添加到' + label;
          chip.addEventListener('click', function () {
            var list = parseList(input.value);
            if (list.indexOf(name) === -1) list.push(name);
            input.value = list.join(', ');
            setDirty(true);
            input.focus();
          });
          chips.appendChild(chip);
        });
        box.appendChild(chips);
      }

      if (hint) box.appendChild(el('span', 'field-hint', hint));
      return { box: box, input: input };
    }

    var titleInput = el('input');
    titleInput.type = 'text';
    titleInput.value = fm.title || '';
    titleInput.addEventListener('input', function () { setDirty(true); });
    grid.appendChild(field('标题', titleInput));

    var dateInput = el('input');
    dateInput.type = 'text';
    dateInput.value = fm.date || '';
    dateInput.placeholder = 'YYYY-MM-DD HH:mm:ss';
    dateInput.addEventListener('input', function () { setDirty(true); });
    grid.appendChild(field('日期', dateInput));

    var descInput = el('textarea');
    descInput.rows = 2;
    descInput.value = fm.description || '';
    descInput.addEventListener('input', function () { setDirty(true); });
    grid.appendChild(field('简介', descInput, '首页卡片和文章头部的描述'));

    var cats = suggestField('分类', fm.categories, 'categories', '多个用逗号分隔，如：数学分析, 第一章');
    var catsInput = cats.input;
    grid.appendChild(cats.box);

    var tags = suggestField('标签', fm.tags, 'tags', '多个用逗号分隔');
    var tagsInput = tags.input;
    grid.appendChild(tags.box);

    var typeSelect = el('select');
    [['', '文章'], ['note', '笔记']].forEach(function (pair) {
      var opt = document.createElement('option');
      opt.value = pair[0];
      opt.textContent = pair[1];
      if ((fm.type || '') === pair[0]) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeSelect.addEventListener('change', function () { setDirty(true); });
    grid.appendChild(field('类型', typeSelect));

    var coverInput = el('input');
    coverInput.type = 'text';
    coverInput.value = fm.cover || '';
    coverInput.placeholder = '/images/xxx.png';
    var coverPreview = makeImagePreview(function () { return coverInput.value; });
    coverInput.addEventListener('input', function () {
      coverPreview.sync();
      setDirty(true);
    });
    var coverField = field('封面', coverInput, '可选，首页卡片缩略图');
    coverField.appendChild(coverPreview.el);
    grid.appendChild(coverField);

    /* 笔记专用字段：普通文章留空即可，保存时会被去掉 */
    var courseInput = el('input');
    courseInput.type = 'text';
    courseInput.value = fm.course || '';
    courseInput.placeholder = '如：工科数学分析（上）';
    courseInput.addEventListener('input', function () { setDirty(true); });
    grid.appendChild(field('课程', courseInput, '笔记专用，普通文章留空'));

    var sourceInput = el('textarea');
    sourceInput.rows = 2;
    sourceInput.value = fm.source || '';
    sourceInput.placeholder = '课件 / 教材章节页';
    sourceInput.addEventListener('input', function () { setDirty(true); });
    grid.appendChild(field('来源', sourceInput, '笔记专用，普通文章留空'));

    var checks = el('div', 'field checks');
    checks.appendChild(el('span', 'field-label', '选项'));

    function checkbox(name, label, checked) {
      var lab = el('label', 'check');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!checked;
      cb.dataset.field = name;
      cb.addEventListener('change', function () { setDirty(true); });
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(' ' + label));
      checks.appendChild(lab);
      return cb;
    }

    var topCb = checkbox('top', '置顶', fm.top);
    var katexCb = checkbox('katex', '数学公式', fm.katex);
    var topImgCb = checkbox('top_img', '文章横幅', fm.top_img === true);
    grid.appendChild(checks);

    container.appendChild(grid);

    /* 正文 */
    var bodyWrap = el('div', 'body-wrap');
    var bodyArea = el('textarea', 'body');
    bodyArea.value = post.body || '';
    bodyArea.spellcheck = false;
    bodyArea.addEventListener('input', function () { setDirty(true); });
    bodyWrap.appendChild(bodyArea);

    var preview = el('div', 'preview');
    bodyWrap.appendChild(preview);
    container.appendChild(bodyWrap);

    /* 全屏：正文 + 预览铺满窗口（Esc 或右上角按钮退出） */
    var fullBtn = el('button', 'btn', '全屏');
    fullBtn.type = 'button';
    fullBtn.dataset.fullscreenBtn = '1';
    fullBtn.addEventListener('click', toggleFullscreen);
    tools.appendChild(fullBtn);

    var exitBtn = el('button', 'btn small fullscreen-exit', '退出全屏 (Esc)');
    exitBtn.type = 'button';
    exitBtn.addEventListener('click', toggleFullscreen);
    bodyWrap.appendChild(exitBtn);

    function toggleFullscreen() {
      var on = bodyWrap.classList.toggle('is-fullscreen');
      fullBtn.textContent = on ? '退出全屏' : '全屏';
    }

    var previewTimer = null;
    function togglePreview() {
      if (preview.classList.contains('is-open')) {
        preview.classList.remove('is-open');
        bodyArea.classList.remove('is-half');
        return;
      }
      preview.classList.add('is-open');
      bodyArea.classList.add('is-half');
      refreshPreview();
    }

    function refreshPreview() {
      api('/api/preview', { method: 'POST', body: { text: bodyArea.value } })
        .then(function (result) { preview.innerHTML = result.html; })
        .catch(function (err) { preview.textContent = '预览失败：' + err.message; });
    }

    bodyArea.addEventListener('input', function () {
      if (!preview.classList.contains('is-open')) return;
      window.clearTimeout(previewTimer);
      previewTimer = window.setTimeout(refreshPreview, 500);
    });

    /* 保存 */
    container._collect = function () {
      var next = Object.assign({}, fm);
      next.title = titleInput.value.trim();
      next.date = dateInput.value.trim();
      next.description = descInput.value.trim();
      next.categories = parseList(catsInput.value);
      next.tags = parseList(tagsInput.value);
      next.cover = coverInput.value.trim();
      next.type = typeSelect.value;
      next.top = topCb.checked;
      next.katex = katexCb.checked;
      if (topImgCb.checked) next.top_img = true; else delete next.top_img;
      next.course = courseInput.value.trim();
      next.source = sourceInput.value.trim();

      /* 空字段写回时去掉，保持 md 干净 */
      ['cover', 'type', 'course', 'source'].forEach(function (key) {
        if (!next[key]) delete next[key];
      });
      if (!next.top) delete next.top;
      if (!next.katex) delete next.katex;

      return { fm: next, body: bodyArea.value };
    };

    /* 地址栏带 ?preview=1 时默认展开预览；?fullscreen=1 直接全屏 */
    var bootParams2 = new URLSearchParams(window.location.search);
    if (bootParams2.get('preview') === '1') togglePreview();
    if (bootParams2.get('fullscreen') === '1') toggleFullscreen();
  }

  function postApiPath(post) {
    return '/api/posts/' + encodeURIComponent(post.file) +
      (post.status === 'draft' ? '?draft=1' : '');
  }

  function saveCurrentPost(container, post) {
    if (!container._collect) return;
    var payload = container._collect();
    api(postApiPath(post), { method: 'PUT', body: payload })
      .then(function () {
        return reload();
      })
      .then(function () {
        toast('已保存');
      })
      .catch(function (err) { toast('保存失败：' + err.message, true); });
  }

  function createPost(draft) {
    var title = window.prompt(draft ? '新草稿标题（存到 _drafts）' : '新文章标题（存到 _posts）');
    if (!title) return;
    if (!confirmLeave()) return;
    api('/api/posts', { method: 'POST', body: { title: title, draft: draft } })
      .then(function (created) {
        state.current = created.file;
        state.currentDraft = created.status === 'draft';
        return reload();
      })
      .then(function () { toast(draft ? '已新建草稿' : '已新建文章'); })
      .catch(function (err) { toast('新建失败：' + err.message, true); });
  }

  function openInVSCode(post) {
    api('/api/open-vscode', {
      method: 'POST',
      body: { file: post.file, draft: post.status === 'draft' }
    })
      .then(function () { toast('已在 VSCode 中打开'); })
      .catch(function (err) { toast('打开失败：' + err.message, true); });
  }

  function publishDraft(post) {
    if (!window.confirm('把《' + (post.fm.title || post.file) + '》转为已发布？\n文件会从 _drafts 移到 _posts。')) return;
    api('/api/posts/' + encodeURIComponent(post.file) + '/publish', { method: 'POST' })
      .then(function (result) {
        state.current = result.file;
        state.currentDraft = false;
        setDirty(false);
        return reload();
      })
      .then(function () { toast('已转为已发布'); })
      .catch(function (err) { toast('发布失败：' + err.message, true); });
  }

  function removePost(post) {
    if (!window.confirm('把《' + (post.fm.title || post.file) + '》移入回收站？')) return;
    api(postApiPath(post), { method: 'DELETE' })
      .then(function () {
        state.current = null;
        setDirty(false);
        return reload();
      })
      .then(function () { toast('已移入回收站'); })
      .catch(function (err) { toast('删除失败：' + err.message, true); });
  }

  /* ---- 说说 -------------------------------------------------------------- */

  function renderShuoshuo() {
    app.innerHTML = '';
    var items = (state.data.shuoshuo || []).slice();

    var head = el('div', 'page-head');
    head.appendChild(el('h2', null, '说说'));
    var add = el('button', 'btn small', '+ 新增');
    add.type = 'button';
    add.addEventListener('click', function () {
      items.unshift({
        date: nowString(),
        /* key 是评论区的唯一标识（Giscus 用 specific + term），新建时必须生成 */
        key: 'shuoshuo-' + Date.now().toString(36),
        content: '',
        tags: []
      });
      state.data.shuoshuo = items;
      paint();
      setDirty(true);
    });
    head.appendChild(add);
    app.appendChild(head);

    var listBox = el('div', 'stack');
    app.appendChild(listBox);

    function paint() {
      listBox.innerHTML = '';
      items.forEach(function (item, index) {
        var card = el('article', 'card');

        var top = el('div', 'card-head');
        var date = el('input');
        date.type = 'text';
        date.value = item.date || '';
        date.placeholder = 'YYYY-MM-DD HH:mm:ss';
        date.addEventListener('input', function () { item.date = date.value; setDirty(true); });
        top.appendChild(date);

        var tags = el('input');
        tags.type = 'text';
        tags.value = joinList(item.tags);
        tags.placeholder = '标签（逗号分隔）';
        tags.addEventListener('input', function () { item.tags = parseList(tags.value); setDirty(true); });
        top.appendChild(tags);

        var del = el('button', 'btn danger small', '删除');
        del.type = 'button';
        del.addEventListener('click', function () {
          items.splice(index, 1);
          state.data.shuoshuo = items;
          paint();
          setDirty(true);
        });
        top.appendChild(del);
        card.appendChild(top);

        var content = el('textarea', 'content');
        content.rows = 6;
        content.value = item.content || '';
        content.addEventListener('input', function () { item.content = content.value; setDirty(true); });
        card.appendChild(content);

        /* 工具行：在 VSCode 里编辑 YAML（定位到这条），以及 Markdown 预览 */
        var tools = el('div', 'card-tools');

        var vscodeBtn = el('button', 'btn small', 'VSCode');
        vscodeBtn.type = 'button';
        vscodeBtn.title = '在 VSCode 中打开 shuoshuo.yml 的这一条';
        vscodeBtn.addEventListener('click', function () {
          api('/api/open-vscode', {
            method: 'POST',
            body: { type: 'data', key: 'shuoshuo', line: item.line }
          })
            .then(function () { toast('已在 VSCode 中打开'); })
            .catch(function (err) { toast('打开失败：' + err.message, true); });
        });
        tools.appendChild(vscodeBtn);

        var preview = el('div', 'shuoshuo-preview');
        var previewBtn = el('button', 'btn small', '预览');
        previewBtn.type = 'button';
        previewBtn.addEventListener('click', function () {
          if (preview.classList.contains('is-open')) {
            preview.classList.remove('is-open');
            return;
          }
          api('/api/preview', {
            method: 'POST',
            body: { text: content.value }
          })
            .then(function (result) {
              preview.innerHTML = result.html;
              preview.classList.add('is-open');
            })
            .catch(function (err) { toast('预览失败：' + err.message, true); });
        });
        tools.appendChild(previewBtn);

        card.appendChild(tools);
        card.appendChild(preview);

        listBox.appendChild(card);
      });
    }

    paint();

    var foot = el('div', 'page-foot');
    var save = el('button', 'btn primary', '保存全部说说');
    save.type = 'button';
    save.addEventListener('click', function () { saveData('shuoshuo', items); });
    foot.appendChild(save);
    app.appendChild(foot);
  }

  /* ---- 歌曲（侧栏歌词卡） ------------------------------------------------ */

  function renderLyrics() {
    app.innerHTML = '';
    var items = (state.data.lyrics || []).slice();

    var head = el('div', 'page-head');
    head.appendChild(el('h2', null, '歌曲'));
    var add = el('button', 'btn small', '+ 歌曲');
    add.type = 'button';
    add.addEventListener('click', function () {
      var id = String(Date.now());
      items.unshift({
        title: '新歌',
        artist: '',
        url: '',
        lrc: '/lrc/' + id + '.lrc',
        duration: 240,
        lines: []
      });
      state.data.lyrics = items;
      paint();
      setDirty(true);
    });
    head.appendChild(add);
    app.appendChild(head);

    var listBox = el('div', 'stack');
    app.appendChild(listBox);

    function lrcName(song) {
      return String(song.lrc || '').split('/').pop();
    }

    function paint() {
      listBox.innerHTML = '';
      items.forEach(function (song, index) {
        var card = el('article', 'card');

        /* 标题 / 歌手 / 删除 */
        var top = el('div', 'card-head');
        var title = el('input');
        title.type = 'text';
        title.value = song.title || '';
        title.placeholder = '歌名';
        title.addEventListener('input', function () { song.title = title.value; setDirty(true); });
        top.appendChild(title);

        var artist = el('input');
        artist.type = 'text';
        artist.value = song.artist || '';
        artist.placeholder = '歌手';
        artist.addEventListener('input', function () { song.artist = artist.value; setDirty(true); });
        top.appendChild(artist);

        var del = el('button', 'btn danger small', '删除');
        del.type = 'button';
        del.addEventListener('click', function () {
          if (!window.confirm('从歌单移除《' + (song.title || '未命名') + '》？（LRC 文件会保留）')) return;
          items.splice(index, 1);
          state.data.lyrics = items;
          paint();
          setDirty(true);
        });
        top.appendChild(del);
        card.appendChild(top);

        /* URL / LRC / 时长 */
        var meta = el('div', 'song-meta');
        [['url', '网易云链接'], ['lrc', 'LRC 路径'], ['duration', '时长（秒）']].forEach(function (pair) {
          var input = el('input');
          input.type = 'text';
          input.value = song[pair[0]] === undefined ? '' : song[pair[0]];
          input.placeholder = pair[1];
          input.addEventListener('input', function () {
            if (pair[0] === 'duration') {
              song.duration = parseInt(input.value, 10) || 0;
            } else {
              song[pair[0]] = input.value;
            }
            setDirty(true);
          });
          meta.appendChild(input);
        });
        card.appendChild(meta);

        /* 纯文本兜底歌词（LRC 加载失败时显示） */
        var lines = el('textarea', 'content');
        lines.rows = 2;
        lines.placeholder = '纯文本歌词（LRC 加载失败时兜底，每行一句）';
        lines.value = (song.lines || []).join(String.fromCharCode(10));
        lines.addEventListener('input', function () {
          song.lines = lines.value.split(String.fromCharCode(10)).map(function (x) { return x.trim(); }).filter(Boolean);
          setDirty(true);
        });
        card.appendChild(lines);

        /* 歌词编辑 */
        var tools = el('div', 'card-tools');
        var lrcBtn = el('button', 'btn small', '编辑歌词');
        lrcBtn.type = 'button';
        tools.appendChild(lrcBtn);

        var lrcBox = el('div', 'lrc-editor');
        var lrcArea = el('textarea', 'content lrc-content');
        lrcArea.rows = 12;
        lrcArea.spellcheck = false;
        lrcArea.placeholder = '[00:48.20]在我的怀里 在你的眼里……';
        var saveLrc = el('button', 'btn small primary', '保存歌词');
        saveLrc.type = 'button';
        saveLrc.addEventListener('click', function () {
          var file = lrcName(song);
          if (!file) return toast('先填 LRC 路径', true);
          api('/api/lrc/' + encodeURIComponent(file), {
            method: 'PUT',
            body: { text: lrcArea.value }
          })
            .then(function () { toast('歌词已保存'); })
            .catch(function (err) { toast('保存失败：' + err.message, true); });
        });

        lrcBtn.addEventListener('click', function () {
          if (lrcBox.classList.contains('is-open')) {
            lrcBox.classList.remove('is-open');
            return;
          }
          var file = lrcName(song);
          if (!file) return toast('先填 LRC 路径', true);
          api('/api/lrc/' + encodeURIComponent(file))
            .then(function (result) {
              lrcArea.value = result.text || '';
              lrcBox.classList.add('is-open');
            })
            .catch(function (err) { toast('读取失败：' + err.message, true); });
        });

        lrcBox.appendChild(lrcArea);
        lrcBox.appendChild(saveLrc);
        card.appendChild(tools);
        card.appendChild(lrcBox);

        listBox.appendChild(card);
      });
    }

    paint();

    var foot = el('div', 'page-foot');
    var save = el('button', 'btn primary', '保存歌单');
    save.type = 'button';
    save.addEventListener('click', function () { saveData('lyrics', items); });
    foot.appendChild(save);
    app.appendChild(foot);
  }

  /* ---- 友链 -------------------------------------------------------------- */

  function renderLinks() {
    app.innerHTML = '';
    var groups = (state.data.link || []).slice();

    var head = el('div', 'page-head');
    head.appendChild(el('h2', null, '友链'));

    var addGroup = el('button', 'btn small', '+ 分组');
    addGroup.type = 'button';
    addGroup.addEventListener('click', function () {
      groups.push({ class_name: '新分组', class_desc: '', link_list: [] });
      state.data.link = groups;
      paint();
      setDirty(true);
    });
    head.appendChild(addGroup);
    app.appendChild(head);

    var listBox = el('div', 'stack');
    app.appendChild(listBox);

    function paint() {
      listBox.innerHTML = '';
      groups.forEach(function (group, gIndex) {
        var card = el('article', 'card');

        var top = el('div', 'card-head');
        var name = el('input');
        name.type = 'text';
        name.value = group.class_name || '';
        name.placeholder = '分组名';
        name.addEventListener('input', function () { group.class_name = name.value; setDirty(true); });
        top.appendChild(name);

        var desc = el('input');
        desc.type = 'text';
        desc.value = group.class_desc || '';
        desc.placeholder = '分组说明（可选）';
        desc.addEventListener('input', function () { group.class_desc = desc.value; setDirty(true); });
        top.appendChild(desc);

        var delGroup = el('button', 'btn danger small', '删除分组');
        delGroup.type = 'button';
        delGroup.addEventListener('click', function () {
          if (!window.confirm('删除这个分组和它下面的所有站点？')) return;
          groups.splice(gIndex, 1);
          state.data.link = groups;
          paint();
          setDirty(true);
        });
        top.appendChild(delGroup);
        card.appendChild(top);

        var sites = el('div', 'sites');
        (group.link_list || []).forEach(function (site, sIndex) {
          var row = el('div', 'site-row');

          [['name', '站点名'], ['link', '链接'], ['avatar', '头像路径'], ['descr', '描述']].forEach(function (pair) {
            var input = el('input');
            input.type = 'text';
            input.value = site[pair[0]] || '';
            input.placeholder = pair[1];
            input.addEventListener('input', function () { site[pair[0]] = input.value; setDirty(true); });

            if (pair[0] === 'avatar') {
              /* 头像：输入框下面直接显示缩略图 */
              var wrap = el('div', 'avatar-field');
              var preview = makeImagePreview(function () { return input.value; });
              input.addEventListener('input', preview.sync);
              wrap.appendChild(input);
              wrap.appendChild(preview.el);
              row.appendChild(wrap);
            } else {
              row.appendChild(input);
            }
          });

          var delSite = el('button', 'btn danger small', '×');
          delSite.type = 'button';
          delSite.title = '删除这个站点';
          delSite.addEventListener('click', function () {
            group.link_list.splice(sIndex, 1);
            paint();
            setDirty(true);
          });
          row.appendChild(delSite);
          sites.appendChild(row);
        });
        card.appendChild(sites);

        var addSite = el('button', 'btn small', '+ 站点');
        addSite.type = 'button';
        addSite.addEventListener('click', function () {
          group.link_list = group.link_list || [];
          group.link_list.push({ name: '', link: '', avatar: '/img/cloud.jpg', descr: '' });
          paint();
          setDirty(true);
        });
        card.appendChild(addSite);

        listBox.appendChild(card);
      });
    }

    paint();

    var foot = el('div', 'page-foot');
    var save = el('button', 'btn primary', '保存友链');
    save.type = 'button';
    save.addEventListener('click', function () { saveData('link', groups); });
    foot.appendChild(save);
    app.appendChild(foot);
  }

  /* ---- 关于 / 公告 -------------------------------------------------------- */

  function renderAbout() {
    var about = state.data.about || { fm: {}, body: '' };
    app.innerHTML = '';

    var head = el('div', 'page-head');
    head.appendChild(el('h2', null, '关于'));
    app.appendChild(head);

    var card = el('article', 'card');
    var area = el('textarea', 'content about');
    area.rows = 24;
    area.value = about.body || '';
    area.addEventListener('input', function () { setDirty(true); });
    card.appendChild(area);
    app.appendChild(card);

    var foot = el('div', 'page-foot');
    var save = el('button', 'btn primary', '保存关于页');
    save.type = 'button';
    save.addEventListener('click', function () {
      api('/api/about', {
        method: 'PUT',
        body: { fm: about.fm, body: area.value }
      }).then(function () {
        setDirty(false);
        return reload();
      }).then(function () { toast('已保存'); })
        .catch(function (err) { toast('保存失败：' + err.message, true); });
    });
    foot.appendChild(save);
    app.appendChild(foot);
  }

  function renderSite() {
    var site = state.data.site || {};
    app.innerHTML = '';

    var head = el('div', 'page-head');
    head.appendChild(el('h2', null, '公告'));
    app.appendChild(head);

    var card = el('article', 'card');
    var area = el('textarea', 'content');
    area.rows = 6;
    area.value = site.announcement || '';
    area.addEventListener('input', function () { setDirty(true); });
    card.appendChild(area);
    app.appendChild(card);

    var foot = el('div', 'page-foot');
    var save = el('button', 'btn primary', '保存公告');
    save.type = 'button';
    save.addEventListener('click', function () {
      saveData('site', { announcement: area.value.trim() });
    });
    foot.appendChild(save);
    app.appendChild(foot);
  }

  function saveData(key, data) {
    api('/api/data/' + key, { method: 'PUT', body: { data: data } })
      .then(function () {
        setDirty(false);
        return reload();
      })
      .then(function () { toast('已保存'); })
      .catch(function (err) { toast('保存失败：' + err.message, true); });
  }

  /* ---- 视图切换 / 发布 ---------------------------------------------------- */

  function render() {
    if (state.view === 'posts') return renderPosts();
    if (state.view === 'shuoshuo') return renderShuoshuo();
    if (state.view === 'lyrics') return renderLyrics();
    if (state.view === 'link') return renderLinks();
    if (state.view === 'about') return renderAbout();
    if (state.view === 'site') return renderSite();
  }

  var lastStateJSON = '';

  function reload() {
    return api('/api/state').then(function (data) {
      state.data = data;
      lastStateJSON = JSON.stringify(data);
      setDirty(false);
      render();
    });
  }

  /* 定时/窗口聚焦时检查磁盘上的文件有没有被外部修改（比如在 VSCode 里保存）。
     有未保存的编辑就跳过，不能把用户正在写的东西冲掉。 */
  function refreshIfChanged() {
    if (state.dirty) return;
    api('/api/state').then(function (data) {
      var json = JSON.stringify(data);
      if (json === lastStateJSON) return;
      state.data = data;
      lastStateJSON = json;
      render();
    }).catch(function () { /* 服务停了就安静等待 */ });
  }

  window.setInterval(refreshIfChanged, 3000);
  window.addEventListener('focus', refreshIfChanged);

  function nowString() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  /* 当前编辑文章的站点地址。
     permalink 是 :year/:month/:day/:title/，:title 就是去掉 .md 的文件名，
     所以可以直接拼出来（中文靠 encodeURIComponent）。 */
  function currentPostUrl() {
    if (state.view !== 'posts' || !state.current) return '';
    var post = (state.data.posts || []).filter(function (p) {
      return p.file === state.current;
    })[0];
    if (!post) return '';
    var m = String(post.fm.date || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    var name = post.file.replace(/\.md$/i, '');
    return 'http://localhost:4000/' + m[1] + '/' + m[2] + '/' + m[3] + '/' +
      encodeURIComponent(name) + '/';
  }

  document.getElementById('btn-refresh').addEventListener('click', function () {
    if (state.dirty && !window.confirm('有未保存的改动，刷新会丢弃，继续？')) return;
    setDirty(false);
    reload()
      .then(function () { toast('已刷新'); })
      .catch(function (err) { toast('刷新失败：' + err.message, true); });
  });

  document.getElementById('btn-site').addEventListener('click', function () {
    var btn = this;
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = '检查中…';

    api('/api/site-status')
      .then(function (status) {
        if (status.running) return status;
        btn.textContent = '启动中…';
        return api('/api/site-start', { method: 'POST' });
      })
      .then(function (result) {
        if (result && result.ok === false) throw new Error(result.error || '启动失败');
        var target = currentPostUrl() || (result && result.url) || 'http://localhost:4000/';
        window.open(target, '_blank', 'noopener');
        toast('已打开站点预览');
      })
      .catch(function (err) {
        toast('预览启动失败：' + err.message, true);
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = label;
      });
  });

  document.getElementById('views').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-view]');
    if (!btn) return;
    var next = btn.dataset.view;
    if (next === state.view) return;
    if (!confirmLeave()) return;
    state.view = next;
    state.current = null;
    Array.prototype.forEach.call(this.querySelectorAll('button'), function (b) {
      b.classList.toggle('is-active', b === btn);
    });
    syncViewUrl();
    setDirty(false);
    render();
  });

  document.getElementById('btn-generate').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    btn.textContent = '生成中…';
    api('/api/generate', { method: 'POST' })
      .then(function (result) {
        toast(result.ok ? '生成完成' : '生成失败，看控制台输出', !result.ok);
        if (!result.ok) console.log(result.output);
      })
      .catch(function (err) { toast('生成失败：' + err.message, true); })
      .then(function () {
        btn.disabled = false;
        btn.textContent = '重新生成';
      });
  });

  document.getElementById('btn-publish').addEventListener('click', function () {
    var message = window.prompt('提交说明（留空用默认）', '更新博客内容');
    if (message === null) return;
    var btn = this;
    btn.disabled = true;
    btn.textContent = '发布中…';
    api('/api/publish', { method: 'POST', body: { message: message } })
      .then(function (result) {
        toast(result.ok ? '已推送，1~2 分钟后上线' : '发布失败', !result.ok);
        console.log(result.output);
      })
      .catch(function (err) { toast('发布失败：' + err.message, true); })
      .then(function () {
        btn.disabled = false;
        btn.textContent = '发布';
      });
  });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      var saveBtn = document.querySelector('.editor-tools .btn.primary, .page-foot .btn.primary');
      if (saveBtn) saveBtn.click();
      return;
    }

    /* Esc 退出全屏 */
    if (e.key === 'Escape') {
      var wrap = document.querySelector('.body-wrap.is-fullscreen');
      if (!wrap) return;
      wrap.classList.remove('is-fullscreen');
      var btn = document.querySelector('[data-fullscreen-btn]');
      if (btn) btn.textContent = '全屏';
    }
  });

  window.addEventListener('beforeunload', function (e) {
    if (!state.dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  /* ---- 启动 -------------------------------------------------------------- */

  /* ?lightbox=/images/xxx.png 直接打开大图（调试/收藏用） */
  var bootLightbox = new URLSearchParams(window.location.search).get('lightbox');
  if (bootLightbox) openLightbox(bootLightbox);

  /* 地址栏带了 view 时，把对应按钮点亮 */
  Array.prototype.forEach.call(document.querySelectorAll('#views button'), function (btn) {
    btn.classList.toggle('is-active', btn.dataset.view === state.view);
  });
  syncViewUrl();

  reload().catch(function (err) {
    app.innerHTML = '<p class="empty">加载失败：' + err.message + '</p>';
  });
})();
