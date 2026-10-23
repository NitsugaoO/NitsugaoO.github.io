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
    dirty: false,
    saveHandler: null,   /* 当前视图的保存函数，顶栏「保存」调用它 */
    git: null            /* 工作区/推送状态，用来区分「已保存未发布」 */
  };

  /* 视图可以直接用 /?view=shuoshuo 打开，切换时同步到地址栏（刷新不丢） */
  var VIEWS = ['posts', 'shuoshuo', 'lyrics', 'images', 'link', 'about', 'site'];
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
    if (keep.get('q')) params.set('q', keep.get('q'));             /* 保留歌曲搜索词 */
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
    if (state.dirty && !state.git) refreshGit();
    updateStatusUI();
  }

  /* 拉一次 git 状态：工作区有没有未提交的文件、本地有没有没推送的提交 */
  function refreshGit() {
    return api('/api/git-status')
      .then(function (git) {
        state.git = git;
        updateStatusUI();
        return git;
      })
      .catch(function () { /* 拿不到就保持旧状态 */ });
  }

  /* 顶栏状态：未保存 > 已保存未发布 > 已同步 */
  function updateStatusUI() {
    var git = state.git || { unpublished: false, ahead: 0, fileCount: 0 };
    var saveBtn = document.getElementById('btn-save');
    var pubBtn = document.getElementById('btn-publish');

    var dirty = state.dirty;
    var unpublished = git.unpublished && !dirty;

    saveBtn.classList.toggle('primary', dirty);
    pubBtn.classList.toggle('primary', unpublished);
    pubBtn.disabled = dirty;

    if (dirty) {
      statusEl.textContent = '有未保存的改动';
      statusEl.className = 'status is-dirty';
    } else if (git.unpublished) {
      var bits = [];
      if (git.fileCount) bits.push(git.fileCount + ' 个文件');
      if (git.ahead) bits.push(git.ahead + ' 个提交');
      statusEl.textContent = '已保存 · 未发布' + (bits.length ? '（' + bits.join('、') + '）' : '');
      statusEl.className = 'status is-unpublished';
    } else {
      statusEl.textContent = '已同步';
      statusEl.className = 'status is-synced';
    }
  }

  /* ---- 点击顶栏状态：列出未发布的文件 ---------------------------------- */

  var statusPopover = null;

  function closeStatusPopover() {
    if (!statusPopover) return;
    statusPopover.remove();
    statusPopover = null;
    document.removeEventListener('click', onStatusOutsideClick, true);
    document.removeEventListener('keydown', onStatusKey);
  }

  function onStatusOutsideClick(e) {
    if (!statusPopover) return;
    if (statusPopover.contains(e.target) || statusEl.contains(e.target)) return;
    closeStatusPopover();
  }

  function onStatusKey(e) {
    if (e.key === 'Escape') closeStatusPopover();
  }

  function renderStatusFiles() {
    if (!statusPopover) return;
    statusPopover.innerHTML = '';

    var git = state.git || {};
    var files = git.files || [];

    statusPopover.appendChild(el('div', 'status-popover-head',
      '已保存但未发布' + (files.length ? '（' + files.length + ' 个文件）' : '')));

    if (files.length) {
      var list = el('ul', 'status-file-list');
      files.forEach(function (file) {
        list.appendChild(el('li', null, file));
      });
      statusPopover.appendChild(list);
    } else {
      statusPopover.appendChild(el('p', 'status-popover-empty', '工作区是干净的'));
    }

    if (git.ahead) {
      statusPopover.appendChild(el('p', 'status-popover-note',
        git.ahead + ' 个本地提交还没推送'));
    }
  }

  function toggleStatusPopover() {
    if (statusPopover) {
      closeStatusPopover();
      return;
    }
    if (!state.git || !state.git.unpublished) return;

    statusPopover = el('div', 'status-popover');
    document.body.appendChild(statusPopover);
    renderStatusFiles();

    var rect = statusEl.getBoundingClientRect();
    statusPopover.style.top = (rect.bottom + 8) + 'px';
    statusPopover.style.right = Math.max(12, window.innerWidth - rect.right) + 'px';

    document.addEventListener('click', onStatusOutsideClick, true);
    document.addEventListener('keydown', onStatusKey);
  }

  statusEl.addEventListener('click', toggleStatusPopover);

  /* 状态刷新时，如果弹层开着就同步内容 */
  var originalUpdateStatusUI = updateStatusUI;
  updateStatusUI = function () {
    originalUpdateStatusUI();
    renderStatusFiles();
    statusEl.style.cursor = (state.git && state.git.unpublished) ? 'pointer' : 'default';
  };

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

  /* 把输入框里的外部图片下载到 source/img/，并把值换成 /img/... */
  function localizeImage(input, preview, btn) {
    var url = input.value.trim();
    if (!/^https?:\/\//i.test(url)) return toast('先填一个 http(s) 图片地址', true);

    btn.disabled = true;
    btn.textContent = '下载中…';
    api('/api/download-image', { method: 'POST', body: { url: url } })
      .then(function (res) {
        input.value = res.path;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (preview) preview.sync();
        setDirty(true);
        toast('已下载到 ' + res.path);
      })
      .catch(function (err) { toast('下载失败：' + err.message, true); })
      .then(function () {
        btn.disabled = false;
        btn.textContent = '下载到本地';
      });
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
    var headline = el('div', 'editor-headline');
    headline.appendChild(el('h2', null, fm.title || post.file));
    headline.appendChild(el('span', 'status-badge ' + (isDraft ? 'draft' : 'published'),
      isDraft ? '草稿' : '已发布'));
    titleBox.appendChild(headline);
    /* 时间单独一行，标题再长也不会把右边按钮挤到第二行 */
    titleBox.appendChild(el('span', 'editor-meta',
      '创建 ' + (fm.date || '未知') + ' · 更新 ' + (post.updated || fm.date || '未知')));
    head.appendChild(titleBox);

    var tools = el('div', 'editor-tools');

    var codeBtn = el('button', 'btn', 'VSCode');
    codeBtn.type = 'button';
    codeBtn.title = '在 VSCode 中打开这个文件';
    codeBtn.addEventListener('click', function () { openInVSCode(post); });
    tools.appendChild(codeBtn);

    var previewBtn = el('button', 'btn', '预览文章');
    previewBtn.type = 'button';
    previewBtn.title = '全屏查看：左边原文，右边渲染效果';
    previewBtn.addEventListener('click', function () { enterFullscreenPreview(); });
    tools.appendChild(previewBtn);

    var siteBtn = el('button', 'btn', '站点预览');
    siteBtn.type = 'button';
    siteBtn.title = '打开本地 hexo server 上这篇文章的页面';
    siteBtn.addEventListener('click', function () { openSitePreview(); });
    tools.appendChild(siteBtn);

    /* 保存统一走顶栏：这里只登记当前视图的保存动作 */
    state.saveHandler = function () { saveCurrentPost(container, post); };

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
    var coverRow = el('div', 'input-row');
    coverRow.appendChild(coverInput);
    var coverLocalBtn = el('button', 'btn small', '下载到本地');
    coverLocalBtn.type = 'button';
    coverLocalBtn.title = '外部图片下载到 source/img/，改用本地路径';
    coverLocalBtn.addEventListener('click', function () {
      localizeImage(coverInput, coverPreview, coverLocalBtn);
    });
    coverRow.appendChild(coverLocalBtn);

    var coverField = el('div', 'field');
    coverField.appendChild(el('span', 'field-label', '封面'));
    coverField.appendChild(coverRow);
    coverField.appendChild(coverPreview.el);
    coverField.appendChild(el('span', 'field-hint', '可选，首页卡片缩略图；外部地址可以点「下载到本地」'));
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

    /* 正文 + 预览 */
    var bodyWrap = el('div', 'body-wrap');
    var bodyFlex = el('div', 'body-flex');
    var bodyArea = el('textarea', 'body');
    bodyArea.value = post.body || '';
    bodyArea.spellcheck = false;
    bodyArea.addEventListener('input', function () { setDirty(true); });
    bodyFlex.appendChild(bodyArea);

    var preview = el('div', 'preview');
    bodyFlex.appendChild(preview);

    /* 全屏预览的头部：文章信息 + 退出 */
    var fullHead = el('div', 'fullscreen-head');
    var fullInfo = el('div', 'fullscreen-info');
    var fullTitle = el('h2', 'fullscreen-title', fm.title || post.file);
    var fullBadge = el('span', 'status-badge ' + (isDraft ? 'draft' : 'published'),
      isDraft ? '草稿' : '已发布');
    var fullMeta = el('span', 'fullscreen-meta', '');
    fullInfo.appendChild(fullTitle);
    fullInfo.appendChild(fullBadge);
    fullInfo.appendChild(fullMeta);
    fullHead.appendChild(fullInfo);

    var exitBtn = el('button', 'btn small', '退出全屏 (Esc)');
    exitBtn.type = 'button';
    exitBtn.addEventListener('click', exitFullscreen);
    fullHead.appendChild(exitBtn);

    bodyWrap.appendChild(fullHead);
    bodyWrap.appendChild(bodyFlex);
    container.appendChild(bodyWrap);

    /* 预览文章：全屏、左边原文右边渲染，顶部带文章信息 */
    function enterFullscreenPreview() {
      if (!preview.classList.contains('is-open')) {
        api('/api/preview', { method: 'POST', body: { text: bodyArea.value } })
          .then(function (result) {
            preview.innerHTML = result.html;
            preview.classList.add('is-open');
            bodyArea.classList.add('is-half');
          })
          .catch(function (err) { toast('预览失败：' + err.message, true); });
      }

      fullTitle.textContent = titleInput.value.trim() || fm.title || post.file;
      fullMeta.textContent = '创建 ' + (dateInput.value || '未知') +
        ' · 更新 ' + (post.updated || dateInput.value || '未知');
      bodyWrap.classList.add('is-fullscreen');
    }

    function exitFullscreen() {
      bodyWrap.classList.remove('is-fullscreen');
      preview.classList.remove('is-open');
      bodyArea.classList.remove('is-half');
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

    /* 地址栏带 ?preview=1 / ?fullscreen=1 时直接进全屏预览 */
    var bootParams2 = new URLSearchParams(window.location.search);
    if (bootParams2.get('preview') === '1' || bootParams2.get('fullscreen') === '1') {
      enterFullscreenPreview();
    }
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

    state.saveHandler = function () { saveData('shuoshuo', items); };
  }

  /* ---- 图片管理 ---------------------------------------------------------- */

  var imagePasteHandler = null;

  function cleanupImageView() {
    if (imagePasteHandler) {
      document.removeEventListener('paste', imagePasteHandler);
      imagePasteHandler = null;
    }
  }

  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function () { toast('已复制 ' + text); })
        .catch(function () { toast('复制失败', true); });
    } else {
      toast(text);
    }
  }

  /* 用新图覆盖旧图（路径不变，所有引用自动生效） */
  function replaceImageFile(image, file, reload) {
    var reader = new FileReader();
    reader.onload = function () {
      var base64 = String(reader.result).split(',')[1];
      api('/api/replace-image', {
        method: 'POST',
        body: { path: image.path, data: base64, mime: file.type }
      })
        .then(function () { toast('已替换 ' + image.path); reload(); })
        .catch(function (err) { toast('替换失败：' + err.message, true); });
    };
    reader.readAsDataURL(file);
  }

  function buildImageCard(image, reload) {
    var card = el('div', 'image-card');

    var img = el('img');
    img.src = image.path + (image.mtime ? '?v=' + encodeURIComponent(image.mtime) : '');
    img.alt = '';
    img.loading = 'lazy';
    img.title = '点击复制路径';
    img.addEventListener('click', function () { copyText(image.path); });
    card.appendChild(img);

    var info = el('div', 'image-info');
    info.appendChild(el('code', null, image.path));
    info.appendChild(el('span', 'image-size', fmtSize(image.size)));

    if (image.refs && image.refs.length) {
      info.appendChild(el('span', 'image-refs', image.refs.length + ' 处引用'));
      var list = el('ul', 'image-ref-list');
      image.refs.slice(0, 4).forEach(function (ref) {
        list.appendChild(el('li', null, ref.file + ':' + ref.line));
      });
      if (image.refs.length > 4) {
        list.appendChild(el('li', null, '…还有 ' + (image.refs.length - 4) + ' 处'));
      }
      info.appendChild(list);
    } else {
      info.appendChild(el('span', 'image-unused', '未引用'));
    }

    var actions = el('div', 'image-actions');

    var replaceBtn = el('button', 'btn small', '替换');
    replaceBtn.type = 'button';
    replaceBtn.title = '用新图覆盖这张图（路径不变，引用处自动生效）';
    var replaceInput = document.createElement('input');
    replaceInput.type = 'file';
    replaceInput.accept = 'image/*';
    replaceInput.style.display = 'none';
    replaceBtn.addEventListener('click', function () { replaceInput.click(); });
    replaceInput.addEventListener('change', function () {
      var file = replaceInput.files[0];
      if (file) replaceImageFile(image, file, reload);
      replaceInput.value = '';
    });
    actions.appendChild(replaceBtn);
    actions.appendChild(replaceInput);

    var del = el('button', 'btn danger small', '×');
    del.type = 'button';
    del.title = '移到回收站';
    del.addEventListener('click', function () {
      if (!window.confirm('把 ' + image.path + ' 移到回收站？引用它的页面会变成坏图。')) return;
      api('/api/delete-image', { method: 'POST', body: { path: image.path } })
        .then(function () { toast('已移入回收站'); reload(); })
        .catch(function (err) { toast('删除失败：' + err.message, true); });
    });
    actions.appendChild(del);
    info.appendChild(actions);

    card.appendChild(info);
    return card;
  }

  function renderImages() {
    app.innerHTML = '';

    var allImages = [];
    var statusFilter = 'all';
    var sourceFilter = '';
    var keyword = '';

    var head = el('div', 'page-head');
    head.appendChild(el('h2', null, '图片'));
    var reloadBtn = el('button', 'btn small', '刷新列表');
    reloadBtn.type = 'button';
    reloadBtn.addEventListener('click', loadImages);
    head.appendChild(reloadBtn);
    app.appendChild(head);

    /* 上传 */
    var drop = el('div', 'image-drop', '把图片拖到这里，或点击选择 / Ctrl+V 粘贴（上传到 source/images/）');
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', function () {
      uploadFiles(fileInput.files);
      fileInput.value = '';
    });
    drop.addEventListener('click', function () { fileInput.click(); });
    drop.addEventListener('dragover', function (e) {
      e.preventDefault();
      drop.classList.add('is-over');
    });
    drop.addEventListener('dragleave', function () { drop.classList.remove('is-over'); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault();
      drop.classList.remove('is-over');
      uploadFiles(e.dataTransfer.files);
    });
    app.appendChild(drop);
    app.appendChild(fileInput);

    /* 筛选：引用状态 + 引用来源 + 搜索 */
    var filters = el('div', 'image-filters');

    var statusChips = el('div', 'status-filter');
    [['all', '全部'], ['used', '已引用'], ['unused', '未引用']].forEach(function (pair) {
      var chip = el('button', 'status-chip' + (pair[0] === 'all' ? ' is-active' : ''), pair[1]);
      chip.type = 'button';
      chip.addEventListener('click', function () {
        statusFilter = pair[0];
        Array.prototype.forEach.call(statusChips.children, function (node) {
          node.classList.toggle('is-active', node === chip);
        });
        applyFilter();
      });
      statusChips.appendChild(chip);
    });
    filters.appendChild(statusChips);

    var sourceSelect = document.createElement('select');
    sourceSelect.className = 'image-source';
    sourceSelect.addEventListener('change', function () {
      sourceFilter = sourceSelect.value;
      applyFilter();
    });
    filters.appendChild(sourceSelect);

    var search = el('input', 'image-search');
    search.type = 'search';
    search.placeholder = '搜索路径…';
    search.addEventListener('input', function () {
      keyword = search.value;
      applyFilter();
    });
    filters.appendChild(search);

    var count = el('span', 'image-count');
    filters.appendChild(count);
    app.appendChild(filters);

    var grid = el('div', 'image-grid');
    app.appendChild(grid);
    app.appendChild(el('p', 'image-hint', '点击缩略图复制路径；「替换」用同格式新图覆盖原文件；「×」移到回收站。'));

    function uploadFiles(files) {
      Array.prototype.forEach.call(files || [], function (file) {
        if (!/^image\//.test(file.type)) return;

        var reader = new FileReader();
        reader.onload = function () {
          var base64 = String(reader.result).split(',')[1];
          api('/api/upload-image', {
            method: 'POST',
            body: { data: base64, mime: file.type, dir: 'images' }
          })
            .then(function (res) {
              toast('已上传 ' + res.path);
              loadImages();
            })
            .catch(function (err) { toast('上传失败：' + err.message, true); });
        };
        reader.readAsDataURL(file);
      });
    }

    imagePasteHandler = function (e) {
      var items = (e.clipboardData || {}).items || [];
      var files = [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') files.push(items[i].getAsFile());
      }
      if (files.length) {
        e.preventDefault();
        uploadFiles(files);
      }
    };
    document.addEventListener('paste', imagePasteHandler);

    function rebuildSourceOptions() {
      var files = {};
      allImages.forEach(function (img) {
        (img.refs || []).forEach(function (ref) { files[ref.file] = true; });
      });
      var list = Object.keys(files).sort();

      sourceSelect.innerHTML = '';
      var all = document.createElement('option');
      all.value = '';
      all.textContent = '全部引用来源';
      sourceSelect.appendChild(all);

      list.forEach(function (file) {
        var opt = document.createElement('option');
        opt.value = file;
        opt.textContent = file;
        sourceSelect.appendChild(opt);
      });

      if (sourceFilter && list.indexOf(sourceFilter) === -1) sourceFilter = '';
      sourceSelect.value = sourceFilter;
    }

    function applyFilter() {
      var kw = keyword.trim().toLowerCase();
      var list = allImages.filter(function (img) {
        var refs = img.refs || [];
        if (statusFilter === 'used' && !refs.length) return false;
        if (statusFilter === 'unused' && refs.length) return false;
        if (sourceFilter && !refs.some(function (ref) { return ref.file === sourceFilter; })) return false;
        if (kw && img.path.toLowerCase().indexOf(kw) === -1) return false;
        return true;
      });

      count.textContent = '共 ' + allImages.length + ' 张 · 显示 ' + list.length + ' 张';
      grid.innerHTML = '';
      if (!list.length) {
        grid.appendChild(el('p', 'empty', '没有符合条件的图片。'));
        return;
      }
      list.forEach(function (image) {
        grid.appendChild(buildImageCard(image, loadImages));
      });
    }

    function loadImages() {
      grid.innerHTML = '<p class="empty">加载中…</p>';
      api('/api/images')
        .then(function (data) {
          allImages = data.images || [];
          rebuildSourceOptions();
          applyFilter();
        })
        .catch(function (err) {
          grid.innerHTML = '';
          grid.appendChild(el('p', 'empty', '加载失败：' + err.message));
        });
    }

    loadImages();
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
        lines: [],
        added: todayString(),
        note: '',
        shuffle: true
      });
      state.data.lyrics = items;
      paint();
      setDirty(true);
    });
    head.appendChild(add);
    app.appendChild(head);

    /* ---- 搜索添加（网易云） ---- */
    var searchBar = el('div', 'song-search');
    var searchInput = el('input');
    searchInput.type = 'search';
    searchInput.placeholder = '搜歌名 / 歌手，或粘贴网易云链接 / 歌曲 id';
    var searchBtn = el('button', 'btn small', '搜索');
    searchBtn.type = 'button';
    searchBar.appendChild(searchInput);
    searchBar.appendChild(searchBtn);
    app.appendChild(searchBar);

    var resultsBox = el('div', 'song-results');
    app.appendChild(resultsBox);

    function formatDuration(sec) {
      var m = Math.floor(sec / 60);
      var s = sec % 60;
      return m + ':' + String(s).padStart(2, '0');
    }

    function paintResults(results) {
      resultsBox.innerHTML = '';
      if (!results.length) {
        resultsBox.appendChild(el('p', 'empty', '没有找到，试试别的关键词。'));
        return;
      }
      results.forEach(function (result) {
        var row = el('div', 'song-result');
        var info = el('div', 'song-result-info');
        info.appendChild(el('strong', null, result.title));
        info.appendChild(el('span', 'song-result-meta',
          [result.artist, result.album, result.duration ? formatDuration(result.duration) : '']
            .filter(Boolean).join(' · ')));
        row.appendChild(info);

        var addBtn = el('button', 'btn small primary', '添加');
        addBtn.type = 'button';
        addBtn.addEventListener('click', function () { addSong(result, addBtn); });
        row.appendChild(addBtn);
        resultsBox.appendChild(row);
      });
    }

    function addSong(result, btn) {
      btn.disabled = true;
      btn.textContent = '添加中…';
      var tlrc = '';

      api('/api/netease/lyric?id=' + encodeURIComponent(result.id))
        .then(function (res) {
          if (!res.lyric) throw new Error('这首歌没有歌词，可以手动粘贴');

          var tasks = [
            api('/api/lrc/' + encodeURIComponent(result.id + '.lrc'), {
              method: 'PUT',
              body: { text: res.lyric }
            })
          ];
          if (res.tlyric) {
            tlrc = '/lrc/' + result.id + '.tlyric.lrc';
            tasks.push(api('/api/lrc/' + encodeURIComponent(result.id + '.tlyric.lrc'), {
              method: 'PUT',
              body: { text: res.tlyric }
            }));
          }
          return Promise.all(tasks);
        })
        .then(function () {
          items.unshift({
            title: result.title,
            artist: result.artist,
            url: 'https://music.163.com/#/song?id=' + result.id,
            lrc: '/lrc/' + result.id + '.lrc',
            tlrc: tlrc || undefined,
            duration: result.duration || 240,
            lines: [],
            added: todayString(),
            note: '',
            shuffle: true
          });
          state.data.lyrics = items;
          return saveData('lyrics', items);
        })
        .then(function () {
          resultsBox.innerHTML = '';
          searchInput.value = '';
          toast('已添加《' + result.title + '》');
        })
        .catch(function (err) {
          btn.disabled = false;
          btn.textContent = '添加';
          toast('添加失败：' + err.message, true);
        });
    }

    function doSearch() {
      var q = searchInput.value.trim();
      if (!q) return;
      searchBtn.disabled = true;
      searchBtn.textContent = '搜索中…';
      api('/api/netease/search?q=' + encodeURIComponent(q))
        .then(function (res) { paintResults(res.results || []); })
        .catch(function (err) { toast('搜索失败：' + err.message, true); })
        .then(function () {
          searchBtn.disabled = false;
          searchBtn.textContent = '搜索';
        });
    }

    searchBtn.addEventListener('click', doSearch);
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doSearch();
    });

    /* ?q=关键词 直接搜一次（调试 / 收藏用） */
    var bootQuery = new URLSearchParams(window.location.search).get('q');
    if (bootQuery) {
      searchInput.value = bootQuery;
      doSearch();
    }

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

        /* 添加时间 / 是否参与随机 / 感想 */
        var extra = el('div', 'song-extra');
        var addedInput = el('input');
        addedInput.type = 'date';
        addedInput.value = song.added || '';
        addedInput.title = '添加时间（显示在歌曲页面）';
        addedInput.addEventListener('change', function () {
          song.added = addedInput.value;
          setDirty(true);
        });
        extra.appendChild(addedInput);

        var shuffleWrap = el('label', 'check');
        var shuffleCb = document.createElement('input');
        shuffleCb.type = 'checkbox';
        shuffleCb.checked = song.shuffle !== false;
        shuffleCb.addEventListener('change', function () {
          song.shuffle = shuffleCb.checked;
          setDirty(true);
        });
        shuffleWrap.appendChild(shuffleCb);
        shuffleWrap.appendChild(document.createTextNode(' 参与随机播放'));
        extra.appendChild(shuffleWrap);

        var note = el('textarea', 'content');
        note.rows = 2;
        note.placeholder = '感想（会显示在 /songs/ 页面）';
        note.value = song.note || '';
        note.addEventListener('input', function () {
          song.note = note.value;
          setDirty(true);
        });
        extra.appendChild(note);
        card.appendChild(extra);

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

        var tlrcBtn = el('button', 'btn small', '拉取翻译');
        tlrcBtn.type = 'button';
        tlrcBtn.title = '从网易云拉取翻译歌词，保存为 <id>.tlyric.lrc';
        tlrcBtn.addEventListener('click', function () {
          var file = lrcName(song);
          var id = String(file).replace(/\.lrc$/i, '');
          if (!id) return toast('先填 LRC 路径', true);

          tlrcBtn.disabled = true;
          tlrcBtn.textContent = '拉取中…';
          api('/api/netease/lyric?id=' + encodeURIComponent(id))
            .then(function (res) {
              if (!res.tlyric) throw new Error('这首歌没有翻译');
              return api('/api/lrc/' + encodeURIComponent(id + '.tlyric.lrc'), {
                method: 'PUT',
                body: { text: res.tlyric }
              }).then(function () {
                song.tlrc = '/lrc/' + id + '.tlyric.lrc';
              });
            })
            .then(function () { return saveData('lyrics', items); })
            .then(function () { toast('已拉取翻译'); })
            .catch(function (err) {
              tlrcBtn.disabled = false;
              tlrcBtn.textContent = '拉取翻译';
              toast('拉取失败：' + err.message, true);
            });
        });
        tools.appendChild(tlrcBtn);

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

    state.saveHandler = function () { saveData('lyrics', items); };
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
              /* 头像：输入框 + 本地化按钮同一行，下面显示缩略图 */
              var wrap = el('div', 'avatar-field');
              var preview = makeImagePreview(function () { return input.value; });
              input.addEventListener('input', preview.sync);

              var avatarRow = el('div', 'input-row');
              avatarRow.appendChild(input);

              var localBtn = el('button', 'btn small', '本地化');
              localBtn.type = 'button';
              localBtn.title = '外部图片下载到 source/img/，改用本地路径';
              localBtn.addEventListener('click', function () {
                localizeImage(input, preview, localBtn);
              });
              avatarRow.appendChild(localBtn);

              wrap.appendChild(avatarRow);
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

    state.saveHandler = function () { saveData('link', groups); };
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

    state.saveHandler = function () {
      api('/api/about', {
        method: 'PUT',
        body: { fm: about.fm, body: area.value }
      }).then(function () {
        setDirty(false);
        return reload();
      }).then(function () { toast('已保存'); })
        .catch(function (err) { toast('保存失败：' + err.message, true); });
    };
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

    state.saveHandler = function () {
      saveData('site', { announcement: area.value.trim() });
    };
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
    cleanupImageView();
    if (state.view === 'posts') return renderPosts();
    if (state.view === 'shuoshuo') return renderShuoshuo();
    if (state.view === 'lyrics') return renderLyrics();
    if (state.view === 'images') return renderImages();
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
      refreshGit();
    });
  }

  /* 定时/窗口聚焦时检查磁盘上的文件有没有被外部修改（比如在 VSCode 里保存）。
     有未保存的编辑就跳过，不能把用户正在写的东西冲掉。 */
  function refreshIfChanged() {
    refreshGit();
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

  function todayString() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

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

  /* 站内预览：确保 hexo server 在跑，然后打开当前文章页面 */
  function openSitePreview() {
    api('/api/site-status')
      .then(function (status) {
        if (status.running) return status;
        toast('启动本地 hexo server…');
        return api('/api/site-start', { method: 'POST' });
      })
      .then(function (result) {
        if (result && result.ok === false) throw new Error(result.error || '启动失败');
        var target = currentPostUrl() || (result && result.url) || 'http://localhost:4000/';
        window.open(target, '_blank', 'noopener');
      })
      .catch(function (err) {
        toast('预览启动失败：' + err.message, true);
      });
  }

  document.getElementById('views').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-view]');
    if (!btn) return;
    var next = btn.dataset.view;
    if (next === state.view) return;
    if (!confirmLeave()) return;
    state.view = next;
    state.current = null;
    state.saveHandler = null;
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

  /* 顶栏「本地」：和编辑器里的站点预览一样，没启动就拉起来再打开 */
  document.getElementById('btn-local').addEventListener('click', function () {
    openSitePreview();
  });

  document.getElementById('btn-save').addEventListener('click', function () {
    if (!state.saveHandler) return toast('当前页面没有可保存的内容', true);
    state.saveHandler();
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
        refreshGit();
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
      var saveBtn = document.getElementById('btn-save');
      if (saveBtn) saveBtn.click();
      return;
    }

    /* Esc 退出全屏预览 */
    if (e.key === 'Escape') {
      var wrap = document.querySelector('.body-wrap.is-fullscreen');
      if (!wrap) return;
      wrap.classList.remove('is-fullscreen');
      var pv = wrap.querySelector('.preview');
      if (pv) pv.classList.remove('is-open');
      var body = wrap.querySelector('.body');
      if (body) body.classList.remove('is-half');
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
