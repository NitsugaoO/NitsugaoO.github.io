/* 数学练习题库 · 前端逻辑（无依赖，经典脚本，可离线打开）
 * 数据来自 assets/data.js（构建期已把 KaTeX 渲染成 HTML，运行时不需要公式引擎）
 */
(function () {
  'use strict';

  var D = window.QUIZ_DATA;
  var E = window.QuizEval;
  if (!D) return;

  var LS_DATA = 'gksx-quiz-v1';
  var LS_THEME = 'gksx-quiz-theme';

  var TYPE_NAME = { choice: '选择', expr: '填数值', self: '自评', find: '找错' };
  var LEVEL_NAME = { 1: '基础', 2: '进阶', 3: '综合' };
  var WEIGHT_NAME = { 3: '必考', 2: '重点', 1: '常规' };
  var COURSE_NAME = { analysis: '工科数学分析（上）', linear: '线性代数' };

  var state = {
    view: 'practice',
    progress: {}, // qid -> 作答记录（按题型存不同字段）
    filter: { course: 'all', chapter: 'all', type: 'all', weight: 'all', q: '' },
    mode: 'normal', // normal | drill
    drillIds: [],
    cur: 0,
  };

  /* ---------------- 持久化 ---------------- */
  function loadState() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_DATA) || '{}');
      if (raw && typeof raw === 'object') {
        state.progress = raw.progress || {};
      }
    } catch (e) {}
  }
  function saveState() {
    try {
      localStorage.setItem(LS_DATA, JSON.stringify({ progress: state.progress }));
    } catch (e) {}
  }

  /* ---------------- 小工具 ---------------- */
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function clamp(n, lo, hi) {
    return n < lo ? lo : n > hi ? hi : n;
  }
  function htmlToText(html) {
    var d = document.createElement('div');
    d.innerHTML = html || '';
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function byId(id) {
    for (var i = 0; i < D.questions.length; i++) {
      if (D.questions[i].id === id) return D.questions[i];
    }
    return null;
  }
  function chapterTitle(id) {
    for (var i = 0; i < D.chapters.length; i++) {
      if (D.chapters[i].id === id) return D.chapters[i].title;
    }
    return id;
  }
  function chapterOf(id) {
    for (var i = 0; i < D.chapters.length; i++) {
      if (D.chapters[i].id === id) return D.chapters[i];
    }
    return null;
  }

  function statusOf(q) {
    var p = state.progress[q.id];
    if (!p) return null;
    if (q.type === 'find') {
      if (p.whyOk) return 'ok';
      if ((p.whyWrong || []).length) return 'no';
      if (p.stepFound) return 'mid';
      return null;
    }
    if (p.status) return p.status;
    if (p.revealed) return 'mid';
    return null;
  }

  /* ---------------- 列表 / 筛选 ---------------- */
  function filteredQuestions() {
    if (state.mode === 'drill') {
      var ids = state.drillIds;
      return D.questions.filter(function (q) {
        return ids.indexOf(q.id) >= 0;
      });
    }
    var qs = state.filter.q.trim().toLowerCase();
    return D.questions.filter(function (q) {
      if (state.filter.course !== 'all' && q.course !== state.filter.course)
        return false;
      if (state.filter.chapter !== 'all' && q.chapter !== state.filter.chapter)
        return false;
      if (state.filter.type !== 'all' && q.type !== state.filter.type)
        return false;
      if (state.filter.weight !== 'all') {
        var w = Number(state.filter.weight);
        if (w === 2) {
          if (q.weight < 2) return false;
        } else if (q.weight !== w) return false;
      }
      if (qs) {
        var hay = q.searchText || q.badge + ' ' + q.topic;
        if (hay.indexOf(qs) < 0) return false;
      }
      return true;
    });
  }
  function currentQuestion() {
    var list = filteredQuestions();
    if (!list.length) return null;
    state.cur = clamp(state.cur, 0, list.length - 1);
    return { q: list[state.cur], list: list };
  }

  /* ---------------- 统计 ---------------- */
  function stats() {
    var done = 0;
    var ok = 0;
    var bad = 0;
    var mid = 0;
    D.questions.forEach(function (q) {
      var st = statusOf(q);
      if (!st) return;
      done++;
      if (st === 'ok') ok++;
      else if (st === 'no') bad++;
      else mid++;
    });
    return {
      total: D.questions.length,
      done: done,
      ok: ok,
      bad: bad,
      mid: mid,
      rate: done ? Math.round((ok / done) * 100) : 0,
    };
  }
  function renderStats() {
    var s = stats();
    var mini = $('#mini-stats');
    if (mini) {
      mini.innerHTML =
        '<span>已答 <b>' +
        s.done +
        '/' +
        s.total +
        '</b></span>' +
        '<span>正确率 <b class="' +
        (s.rate >= 60 ? 'up' : s.rate > 0 ? 'down' : '') +
        '">' +
        s.rate +
        '%</b></span>' +
        '<span>错题 <b class="' +
        (s.bad ? 'down' : '') +
        '">' +
        s.bad +
        '</b></span>';
    }
    var wc = $('#wrong-count');
    if (wc) wc.textContent = s.bad;
    var gp = $('#grid-progress');
    if (gp) gp.textContent = s.done + '/' + s.total;
    var fs = $('#foot-stats');
    if (fs) {
      fs.textContent =
        '题库 ' +
        s.total +
        ' 题（数分 ' +
        D.counts.byCourse.analysis +
        ' · 线代 ' +
        D.counts.byCourse.linear +
        '）· 找错 ' +
        D.counts.byType.find +
        ' 道 · 技巧卡 ' +
        D.counts.tips +
        ' 张';
    }
  }

  function renderChapterStats() {
    var box = $('#chapter-stats');
    if (!box) return;
    var chs = D.chapters.filter(function (c) {
      return state.filter.course === 'all' || c.course === state.filter.course;
    });
    var rows = chs.map(function (ch) {
      var list = D.questions.filter(function (q) {
        return q.chapter === ch.id;
      });
      var done = 0;
      var ok = 0;
      list.forEach(function (q) {
        var st = statusOf(q);
        if (!st) return;
        done++;
        if (st === 'ok') ok++;
      });
      var pct = list.length ? Math.round((done / list.length) * 100) : 0;
      var acc = done ? Math.round((ok / done) * 100) : 0;
      return (
        '<div class="cs-row" title="' +
        ch.title +
        ' · 已做 ' +
        done +
        '/' +
        list.length +
        '，正确率 ' +
        acc +
        '%">' +
        '<span class="cs-name">' +
        ch.title.replace(/^第\s*\d+\s*章\s*/, '') +
        '</span>' +
        '<span class="cs-bar"><i style="width:' +
        pct +
        '%"></i></span>' +
        '<span class="cs-num">' +
        done +
        '/' +
        list.length +
        '</span>' +
        '</div>'
      );
    });
    box.innerHTML =
      '<div class="cs-head">章节进度</div>' + rows.join('') || '';
  }

  /* ---------------- 筛选 chips ---------------- */
  function renderFilterChips() {
    var cbox = $('#course-filter');
    if (cbox) {
      var courses = [
        ['all', '全部课程'],
        ['analysis', '工科数学分析'],
        ['linear', '线性代数'],
      ];
      cbox.innerHTML = courses
        .map(function (c) {
          return (
            '<button type="button" class="chip" data-act="filter-course" data-course="' +
            c[0] +
            '" aria-pressed="' +
            (state.filter.course === c[0]) +
            '">' +
            c[1] +
            '</button>'
          );
        })
        .join('');
    }

    var box = $('#chapter-filter');
    if (box) {
      var list = D.chapters.filter(function (c) {
        return state.filter.course === 'all' || c.course === state.filter.course;
      });
      var html =
        '<button type="button" class="chip" data-act="filter-chapter" data-ch="all" aria-pressed="' +
        (state.filter.chapter === 'all') +
        '">全部章节</button>';
      list.forEach(function (c) {
        html +=
          '<button type="button" class="chip" data-act="filter-chapter" data-ch="' +
          c.id +
          '" aria-pressed="' +
          (state.filter.chapter === c.id) +
          '">' +
          c.title.replace(/^第\s*\d+\s*章\s*/, '') +
          '</button>';
      });
      box.innerHTML = html;
    }

    var tbox = $('#type-filter');
    if (tbox) {
      var types = [
        ['all', '全部题型'],
        ['choice', '选择'],
        ['expr', '填数值'],
        ['self', '自评'],
        ['find', '找错'],
      ];
      tbox.innerHTML = types
        .map(function (t) {
          return (
            '<button type="button" class="chip" data-act="filter-type" data-type="' +
            t[0] +
            '" aria-pressed="' +
            (state.filter.type === t[0]) +
            '">' +
            t[1] +
            '</button>'
          );
        })
        .join('');
    }

    var wbox = $('#weight-filter');
    if (wbox) {
      var weights = [
        ['all', '全部重要性'],
        ['3', '必考'],
        ['2', '重点及以上'],
        ['1', '常规'],
      ];
      wbox.innerHTML = weights
        .map(function (w) {
          return (
            '<button type="button" class="chip" data-act="filter-weight" data-weight="' +
            w[0] +
            '" aria-pressed="' +
            (state.filter.weight === w[0]) +
            '">' +
            w[1] +
            '</button>'
          );
        })
        .join('');
    }
  }

  /* ---------------- 交互区 ---------------- */
  function optionState(q, o) {
    var p = state.progress[q.id];
    if (!p || !p.pick) return '';
    if (o.key === q.key) return 'correct';
    if (p.pick === o.key) return 'wrong';
    return 'dim';
  }

  function fieldStateHtml(q, i) {
    var p = state.progress[q.id];
    if (!p || !p.fieldOk) return { state: '', msg: '' };
    var ok = p.fieldOk[i];
    return { state: ok ? 'correct' : 'wrong', msg: ok ? '✓ 正确' : '✗ 再算算' };
  }

  function buildFindInteraction(q) {
    var p = state.progress[q.id] || {};
    var tried = p.tried || [];
    var whyWrong = p.whyWrong || [];
    var html = '';

    html +=
      '<div class="hint" style="margin:4px 0 8px">点一下你认为出错的那一步：</div>';
    html += '<div class="steps">';
    q.steps.forEach(function (s, i) {
      var st = '';
      if (p.stepFound && i === q.wrong) st = 'found';
      else if (tried.indexOf(i) >= 0) st = 'excluded';
      var mark = st === 'found' ? '就是这一步' : st === 'excluded' ? '没问题' : '';
      html +=
        '<button type="button" class="step" data-act="find-step" data-i="' +
        i +
        '"' +
        (st ? ' data-state="' + st + '"' : '') +
        (p.whyOk ? ' disabled' : '') +
        '>' +
        '<span class="sno">' +
        (i + 1) +
        '</span>' +
        '<span class="stext">' +
        s +
        '</span>' +
        '<span class="smark">' +
        mark +
        '</span></button>';
    });
    html += '</div>';

    if (p.stepFound && !p.whyOk) {
      html +=
        '<div class="verdict mid">✓ 第 ' + (q.wrong + 1) + ' 步确实有问题 —— 再选出错因</div>';
    } else if (p.whyOk) {
      html += '<div class="verdict ok">✓ 找到错误步骤，并选对了错因</div>';
    } else if (tried.length) {
      html += '<div class="verdict no">已排除 ' + tried.length + ' 步，继续找</div>';
    }

    html +=
      '<div class="why-box" data-whybox' + (p.stepFound ? '' : ' hidden') + '>' +
      '<p class="why-title">错因是哪一个？</p><div class="why-list">';
    q.whyOptions.forEach(function (o) {
      var st = '';
      if (p.whyOk && o.key === q.why) st = 'correct';
      else if (whyWrong.indexOf(o.key) >= 0) st = 'wrong';
      html +=
        '<button type="button" class="why" data-act="find-why" data-key="' +
        o.key +
        '"' +
        (st ? ' data-state="' + st + '"' : '') +
        (p.whyOk ? ' disabled' : '') +
        '><span class="wkey">' +
        o.key +
        '</span><span>' +
        o.html +
        '</span></button>';
    });
    html += '</div></div>';

    if (p.whyOk || (p.whyWrong || []).length) {
      html +=
        '<div class="actions">' +
        '<button type="button" class="btn ghost" data-act="retry">重做这题</button>' +
        '</div>';
    }
    return html;
  }

  function buildInteraction(q) {
    var p = state.progress[q.id];
    var html = '';

    if (q.type === 'find') return buildFindInteraction(q);

    if (q.type === 'choice') {
      html += '<div class="options" role="group" aria-label="选项">';
      q.options.forEach(function (o) {
        var st = optionState(q, o);
        html +=
          '<button type="button" class="opt" data-act="pick-option" data-key="' +
          o.key +
          '"' +
          (st ? ' data-state="' + st + '"' : '') +
          (p && p.pick ? ' disabled' : '') +
          '><span class="okey">' +
          o.key +
          '</span><span class="otext">' +
          o.html +
          '</span></button>';
      });
      html += '</div>';
      if (p && p.pick) {
        html +=
          '<div class="verdict ' +
          (p.status === 'ok' ? 'ok' : 'no') +
          '">' +
          (p.status === 'ok' ? '✓ 答对了' : '✗ 正确答案是 ' + q.key) +
          '</div>';
      }
      html +=
        '<div class="actions">' +
        (p && p.pick
          ? '<button type="button" class="btn ghost" data-act="retry">再做一次</button>'
          : '') +
        '</div>';
    } else if (q.type === 'expr') {
      html += '<div class="fields">';
      q.fields.forEach(function (f, i) {
        var fs = fieldStateHtml(q, i);
        html +=
          '<div class="field" data-fi="' +
          i +
          '"' +
          (fs.state ? ' data-state="' + fs.state + '"' : '') +
          '><label>' +
          (f.label ? f.label : '你的答案') +
          '</label>' +
          '<input type="text" autocomplete="off" spellcheck="false" inputmode="text" placeholder="如 3/4、e^-4" value="' +
          (p && p.inputs && p.inputs[i]
            ? String(p.inputs[i]).replace(/"/g, '&quot;')
            : '') +
          '" /><span class="fmsg">' +
          fs.msg +
          '</span></div>';
      });
      html += '</div>';
      html +=
        '<div class="actions">' +
        '<button type="button" class="btn primary" data-act="submit-expr">' +
        (p ? '再提交' : '提交') +
        '</button>' +
        '<span class="hint">支持 <code>3/4</code>、<code>e^-4</code>、<code>100!</code>、<code>sqrt(2)</code>，也可直接粘 LaTeX 如 <code>\\frac{1}{12}</code></span>' +
        '</div>';
      if (p && p.fieldOk) {
        html +=
          '<div class="verdict ' +
          (p.status === 'ok' ? 'ok' : 'no') +
          '">' +
          (p.status === 'ok' ? '✓ 全部答对' : '✗ 还有空没对，改一改再提交') +
          '</div>';
      }
      html +=
        '<div class="actions">' +
        (p ? '<button type="button" class="btn ghost" data-act="retry">清空重做</button>' : '') +
        '</div>';
    } else {
      // self
      if (!p || !p.revealed) {
        html +=
          '<div class="actions">' +
          '<button type="button" class="btn primary" data-act="reveal">先自己算，再看答案</button>' +
          '<span class="hint">点击后展开完整解析，对照自评</span></div>';
      } else {
        html +=
          '<div class="verdict ' +
          (p.status ? (p.status === 'ok' ? 'ok' : 'no') : 'mid') +
          '">' +
          (p.status === 'ok'
            ? '✓ 已记为「算对了」'
            : p.status === 'no'
            ? '✗ 已放进错题本'
            : '答案已展开：对照后点下面的按钮') +
          '</div>';
        if (!p.status) {
          html +=
            '<div class="actions">' +
            '<button type="button" class="btn primary" data-act="self-ok">我算对了</button>' +
            '<button type="button" class="btn danger" data-act="self-bad">我算错了</button></div>';
        } else {
          html +=
            '<div class="actions">' +
            '<button type="button" class="btn ghost" data-act="retry">重做这题</button></div>';
        }
      }
    }
    return html;
  }

  function buildNotes(q) {
    if (!q.notes || !q.notes.length) return '';
    return q.notes
      .map(function (n) {
        return (
          '<div class="note ' +
          (n.label === '易错点' ? 'mistake' : '') +
          '"><span class="note-label">' +
          n.label +
          '</span><div>' +
          n.html +
          '</div></div>'
        );
      })
      .join('');
  }

  /* ---------------- 练习卡 ---------------- */
  function renderPracticeStage() {
    var stage = $('#stage');
    if (!stage) return;
    var cur = currentQuestion();
    if (!cur) {
      stage.innerHTML =
        '<div class="empty">' +
        (state.mode === 'drill'
          ? '错题已经清空了 —— 去「练习」继续刷题吧。'
          : '这个筛选下没有题目，换个条件或清空搜索试试。') +
        '</div>';
      renderGrid();
      renderChapterStats();
      return;
    }
    var q = cur.q;
    var p = state.progress[q.id];
    var st = statusOf(q);

    var isFind = q.type === 'find';
    var showSol = isFind ? !!(p && p.whyOk) : !!(p && (q.type !== 'self' || p.revealed));

    var head =
      '<header class="q-head">' +
      '<span class="qno">' +
      q.badge +
      '</span>' +
      '<span class="tag type">' +
      TYPE_NAME[q.type] +
      '</span>' +
      '<span class="tag level">' +
      (LEVEL_NAME[q.level] || '') +
      '</span>' +
      '<span class="tag weight w' +
      q.weight +
      '">' +
      (WEIGHT_NAME[q.weight] || '') +
      '</span>' +
      (isFind && q.related
        ? '<span class="tag">改编自宋 ' + q.related + '</span>'
        : '') +
      '<span class="q-topic">' +
      q.topic +
      '</span>' +
      '</header>';

    var body = isFind
      ? '<h2 class="fe-title">' +
        q.title +
        '</h2><div class="fe-prompt">' +
        q.promptHtml +
        '</div>'
      : '<div class="q-body">' + q.stemHtml + '</div>';

    var solBody = isFind ? q.explainHtml : q.answerHtml;

    var html =
      '<article class="card" data-qid="' +
      q.id +
      '">' +
      head +
      body +
      buildInteraction(q) +
      '<div class="solution" data-sol' +
      (showSol ? '' : ' hidden') +
      '>' +
      '<div class="sol-head">' +
      (isFind ? '正解与要点' : '答案与解析') +
      '</div>' +
      '<div class="sol-body">' +
      solBody +
      '</div>' +
      (isFind ? '' : buildNotes(q)) +
      '</div>' +
      '<div class="pager">' +
      '<button type="button" class="btn ghost" data-act="prev"' +
      (state.cur === 0 ? ' disabled' : '') +
      '>← 上一题</button>' +
      '<span class="pos">' +
      (state.cur + 1) +
      ' / ' +
      cur.list.length +
      ' · ' +
      chapterTitle(q.chapter) +
      '</span>' +
      '<button type="button" class="btn ghost" data-act="next"' +
      (state.cur >= cur.list.length - 1 ? ' disabled' : '') +
      '>下一题 →</button>' +
      '</div></article>';
    stage.innerHTML = html;
    renderGrid();
    renderChapterStats();
  }

  function renderGrid() {
    var grid = $('#qgrid');
    if (!grid) return;
    var list = filteredQuestions();
    var cur = list[state.cur];
    grid.innerHTML = list
      .map(function (q, i) {
        var st = statusOf(q);
        var cls = 'gcell';
        if (st === 'ok') cls += ' ok';
        else if (st === 'no') cls += ' no';
        else if (st === 'mid') cls += ' mid';
        if (q.course === 'linear') cls += ' la';
        if (q.type === 'find') cls += ' fe';
        if (cur && cur.id === q.id) cls += ' cur';
        return (
          '<button type="button" class="' +
          cls +
          '" data-act="goto-q" data-idx="' +
          i +
          '" title="' +
          q.badge +
          ' · ' +
          q.topic +
          '">' +
          q.grid +
          '</button>'
        );
      })
      .join('');
    var curEl = grid.querySelector('.cur');
    if (curEl && curEl.scrollIntoView)
      curEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /* ---------------- 错题本 ---------------- */
  function wrongList() {
    return D.questions.filter(function (q) {
      return statusOf(q) === 'no';
    });
  }

  function renderWrong() {
    var box = $('#wrong-list');
    if (!box) return;
    var items = wrongList();
    if (!items.length) {
      box.innerHTML =
        '<div class="empty">错题本是空的 —— 去「练习」里答几题吧。<br /><span class="hint">答错、自评「算错了」、找错题选错错因，都会自动收进来。</span></div>';
      return;
    }
    box.innerHTML = items
      .map(function (q) {
        var title =
          q.type === 'find' ? q.title : htmlToText(q.stemHtml).slice(0, 120);
        return (
          '<div class="wrong-item">' +
          '<div class="wi-main"><div class="wi-title">' +
          title +
          '</div><div class="wi-meta">' +
          q.badge +
          ' · ' +
          q.topic +
          ' · <span class="badge-kind">' +
          TYPE_NAME[q.type] +
          '</span></div></div>' +
          '<button type="button" class="btn primary" data-act="goto-qid" data-qid="' +
          q.id +
          '">去重做</button></div>'
        );
      })
      .join('');
  }

  function startDrill() {
    var items = wrongList();
    if (!items.length) {
      window.alert('错题本是空的，先去练习吧。');
      return;
    }
    state.mode = 'drill';
    state.drillIds = items.map(function (q) {
      return q.id;
    });
    state.cur = 0;
    setView('practice');
    updateDrillBanner();
    renderPracticeStage();
  }
  function exitDrill() {
    state.mode = 'normal';
    state.drillIds = [];
    state.cur = 0;
    updateDrillBanner();
    renderPracticeStage();
  }
  function updateDrillBanner() {
    var banner = $('#drill-banner');
    if (!banner) return;
    if (state.mode !== 'drill') {
      banner.hidden = true;
      return;
    }
    banner.hidden = false;
    var left = state.drillIds.filter(function (id) {
      var q = byId(id);
      return q && statusOf(q) === 'no';
    }).length;
    $('#drill-text').textContent =
      '错题重练中 · 本轮 ' +
      state.drillIds.length +
      ' 题 · 还剩 ' +
      left +
      ' 题未攻克';
  }

  function exportProgress() {
    var payload = {
      exportedAt: new Date().toISOString(),
      stats: stats(),
      progress: state.progress,
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'quiz-progress-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  }

  /* ---------------- 知识点 ---------------- */
  function renderTopics() {
    var box = $('#topics-list');
    if (!box) return;
    var html = '';

    ['analysis', 'linear'].forEach(function (cid) {
      var chs = D.chapters.filter(function (c) {
        return c.course === cid;
      });
      if (!chs.length) return;
      var total = D.questions.filter(function (q) {
        return q.course === cid;
      }).length;
      html +=
        '<section class="course-block" data-course="' +
        cid +
        '"><h2 class="course-title">' +
        COURSE_NAME[cid] +
        '<small>' +
        total +
        ' 题 · ' +
        chs.length +
        ' 章</small></h2>';

      chs.forEach(function (ch) {
        var qs = D.questions.filter(function (q) {
          return q.chapter === ch.id;
        });
        var order = [];
        var map = {};
        qs.forEach(function (q) {
          if (!map[q.topic]) {
            map[q.topic] = [];
            order.push(q.topic);
          }
          map[q.topic].push(q);
        });
        var tips = D.tips.filter(function (t) {
          return t.course === cid && t.chapter === ch.id;
        });

        html +=
          '<div class="topic-chapter"><h3>' +
          ch.title +
          '<small>' +
          ch.sub +
          ' · ' +
          qs.length +
          ' 题</small></h3>';

        tips.forEach(function (t, ti) {
          html +=
            '<details class="tip"><summary>' +
            t.titleHtml +
            '</summary><div class="tip-body">' +
            t.bodyHtml +
            '</div></details>';
        });

        order.forEach(function (topic, ti) {
          var list = map[topic];
          var points = [];
          var seen = {};
          list.forEach(function (q) {
            (q.notes || []).forEach(function (n) {
              var key = q.topic + '|' + n.html;
              if (seen[key]) return;
              seen[key] = 1;
              points.push(
                '<div class="topic-point"><span class="tp-from">' +
                  q.badge +
                  ' · ' +
                  n.label +
                  '</span>' +
                  n.html +
                  '</div>'
              );
            });
          });
          html +=
            '<details class="topic"' +
            (ti === 0 && !tips.length ? ' open' : '') +
            '><summary>' +
            topic +
            '<span class="tcount">' +
            list.length +
            ' 题</span></summary><div class="topic-body">' +
            (points.length
              ? points.join('')
              : '<p class="hint">完整推导见题目解析（点下方题号查看）' +
                (tips.length ? '，本章套路见上方技巧卡。' : '。') +
                '</p>') +
            '<div class="qlinks">' +
            list
              .map(function (q) {
                return (
                  '<button type="button" class="qlink" data-act="goto-qid" data-qid="' +
                  q.id +
                  '">' +
                  q.badge +
                  '</button>'
                );
              })
              .join('') +
            '</div></div></details>';
        });
        html += '</div>';
      });

      // 本课程通用技巧
      var general = D.tips.filter(function (t) {
        return t.course === cid && !t.chapter;
      });
      if (general.length) {
        html += '<h3 class="sub-title">通用技巧</h3>';
        general.forEach(function (t) {
          html +=
            '<details class="tip" open><summary>' +
            t.titleHtml +
            '</summary><div class="tip-body">' +
            t.bodyHtml +
            '</div></details>';
        });
      }
      html += '</section>';
    });

    box.innerHTML = html || '<div class="empty">暂无知识点。</div>';
  }

  /* ---------------- 视图 ---------------- */
  function setView(view, opts) {
    opts = opts || {};
    if (['practice', 'wrong', 'topics', 'about'].indexOf(view) < 0) view = 'practice';
    state.view = view;
    $$('.tab').forEach(function (t) {
      t.setAttribute('aria-selected', String(t.dataset.view === view));
    });
    $$('.view').forEach(function (v) {
      v.classList.toggle('active', v.id === 'view-' + view);
    });
    if (view === 'practice') {
      renderPracticeStage();
      updateDrillBanner();
    }
    if (view === 'wrong') renderWrong();
    if (view === 'topics') renderTopics();
    renderStats();
    if (!opts.noScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function gotoQuestion(qid) {
    var list = filteredQuestions();
    var idx = list
      .map(function (q) {
        return q.id;
      })
      .indexOf(qid);
    if (idx < 0) {
      if (state.mode === 'drill') exitDrill();
      state.filter.course = 'all';
      state.filter.chapter = 'all';
      state.filter.type = 'all';
      state.filter.weight = 'all';
      state.filter.q = '';
      var input = $('#search-input');
      if (input) input.value = '';
      renderFilterChips();
      list = filteredQuestions();
      idx = list
        .map(function (q) {
          return q.id;
        })
        .indexOf(qid);
    }
    state.cur = Math.max(0, idx);
    setView('practice');
  }

  /* ---------------- 作答 ---------------- */
  function recordAnswer(qid, patch) {
    var p = state.progress[qid] || {};
    for (var k in patch) p[k] = patch[k];
    p.ts = Date.now();
    state.progress[qid] = p;
    saveState();
    renderStats();
    updateDrillBanner();
  }

  function pickOption(q, key) {
    var p = state.progress[q.id];
    if (p && p.pick) return;
    recordAnswer(q.id, { pick: key, status: key === q.key ? 'ok' : 'no' });
    renderPracticeStage();
  }

  function submitExpr(q) {
    var card = $('.card[data-qid="' + q.id + '"]');
    if (!card) return;
    var inputs = $$('.field input', card).map(function (inp) {
      return inp.value;
    });
    var fieldOk = q.fields.map(function (f, i) {
      return E.isCorrect(inputs[i], f.expect);
    });
    var allOk = fieldOk.every(Boolean);
    recordAnswer(q.id, {
      inputs: inputs,
      fieldOk: fieldOk,
      status: allOk ? 'ok' : 'no',
    });
    renderPracticeStage();
  }

  function retry(qid) {
    delete state.progress[qid];
    saveState();
    renderPracticeStage();
    renderStats();
    updateDrillBanner();
  }

  function findStep(qid, i) {
    var q = byId(qid);
    var p = state.progress[qid] || {};
    p.tried = p.tried || [];
    if (i === q.wrong) p.stepFound = true;
    else if (p.tried.indexOf(i) < 0) p.tried.push(i);
    recordAnswer(qid, p);
    renderPracticeStage();
  }

  function findWhy(qid, key) {
    var q = byId(qid);
    var p = state.progress[qid] || {};
    p.whyWrong = p.whyWrong || [];
    if (key === q.why) p.whyOk = true;
    else if (p.whyWrong.indexOf(key) < 0) p.whyWrong.push(key);
    recordAnswer(qid, p);
    renderPracticeStage();
  }

  /* ---------------- 主题 ---------------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem(LS_THEME, t);
    } catch (e) {}
  }
  function toggleTheme() {
    var now = document.documentElement.getAttribute('data-theme');
    applyTheme(now === 'dark' ? 'light' : 'dark');
  }

  /* ---------------- 事件 ---------------- */
  document.addEventListener('click', function (e) {
    var tab = e.target.closest ? e.target.closest('.tab') : null;
    if (tab) {
      var v = tab.dataset.view;
      if (location.hash.slice(1).split('/')[0] !== v) location.hash = v;
      else setView(v);
      return;
    }
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t) return;
    var act = t.dataset.act;

    if (act === 'filter-course') {
      state.filter.course = t.dataset.course;
      state.filter.chapter = 'all';
      state.cur = 0;
      renderFilterChips();
      renderPracticeStage();
      return;
    }
    if (act === 'filter-chapter') {
      state.filter.chapter = t.dataset.ch;
      var curCh = chapterOf(state.filter.chapter);
      if (curCh) state.filter.course = curCh.course;
      state.cur = 0;
      renderFilterChips();
      renderPracticeStage();
      return;
    }
    if (act === 'filter-type') {
      state.filter.type = t.dataset.type;
      state.cur = 0;
      renderFilterChips();
      renderPracticeStage();
      return;
    }
    if (act === 'filter-weight') {
      state.filter.weight = t.dataset.weight;
      state.cur = 0;
      renderFilterChips();
      renderPracticeStage();
      return;
    }
    if (act === 'goto-q') {
      state.cur = Number(t.dataset.idx) || 0;
      renderPracticeStage();
      return;
    }
    if (act === 'goto-qid') {
      gotoQuestion(t.dataset.qid);
      return;
    }
    if (act === 'prev') {
      state.cur = clamp(state.cur - 1, 0, Math.max(0, filteredQuestions().length - 1));
      renderPracticeStage();
      return;
    }
    if (act === 'next') {
      state.cur = clamp(state.cur + 1, 0, Math.max(0, filteredQuestions().length - 1));
      renderPracticeStage();
      return;
    }
    if (act === 'random') {
      var list = filteredQuestions();
      if (list.length > 1) {
        var n = state.cur;
        while (n === state.cur) n = Math.floor(Math.random() * list.length);
        state.cur = n;
      }
      renderPracticeStage();
      return;
    }
    if (act === 'reset') {
      if (window.confirm('清空本机的作答进度和错题本？')) {
        state.progress = {};
        saveState();
        exitDrill();
        renderPracticeStage();
        renderWrong();
        renderStats();
      }
      return;
    }
    if (act === 'drill') {
      startDrill();
      return;
    }
    if (act === 'drill-exit') {
      exitDrill();
      return;
    }
    if (act === 'export') {
      exportProgress();
      return;
    }
    if (act === 'tips-open' || act === 'tips-close') {
      var open = act === 'tips-open';
      $$('.tip').forEach(function (d) {
        d.open = open;
      });
      return;
    }

    var card = t.closest('.card');
    if (!card) return;
    var qid = card.dataset.qid;
    if (!qid) return;
    var q = byId(qid);

    if (act === 'pick-option') {
      pickOption(q, t.dataset.key);
      return;
    }
    if (act === 'submit-expr') {
      submitExpr(q);
      return;
    }
    if (act === 'reveal') {
      recordAnswer(qid, { revealed: true });
      renderPracticeStage();
      return;
    }
    if (act === 'self-ok') {
      recordAnswer(qid, { status: 'ok', revealed: true });
      renderPracticeStage();
      return;
    }
    if (act === 'self-bad') {
      recordAnswer(qid, { status: 'no', revealed: true });
      renderPracticeStage();
      return;
    }
    if (act === 'retry') {
      retry(qid);
      return;
    }
    if (act === 'find-step') {
      findStep(qid, Number(t.dataset.i));
      return;
    }
    if (act === 'find-why') {
      findWhy(qid, t.dataset.key);
      return;
    }
  });

  var themeBtn = $('#theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  var searchInput = $('#search-input');
  if (searchInput) {
    var timer = null;
    searchInput.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        state.filter.q = searchInput.value;
        state.cur = 0;
        renderPracticeStage();
      }, 120);
    });
  }

  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    var inInput = tag === 'input' || tag === 'textarea';
    if (inInput) {
      if (e.key === 'Enter' && tag === 'input') {
        var card0 = e.target.closest('.card');
        if (card0) {
          var btn = $('[data-act="submit-expr"]', card0);
          if (btn) {
            e.preventDefault();
            btn.click();
          }
        }
      }
      return;
    }
    var card = $('.card');
    if (!card) return;
    if (e.key === 'ArrowLeft') {
      var prev = $('[data-act="prev"]');
      if (prev && !prev.disabled) prev.click();
    } else if (e.key === 'ArrowRight') {
      var nx = $('[data-act="next"]');
      if (nx && !nx.disabled) nx.click();
    } else if (/^[1-4]$/.test(e.key)) {
      var opts = $$('.opt:not([disabled])');
      var idx = Number(e.key) - 1;
      if (opts[idx]) opts[idx].click();
    } else if (e.key === 'Enter') {
      var main = $('.actions .btn.primary');
      if (main) main.click();
    }
  });

  /* ---------------- 路由 ---------------- */
  function applyRoute() {
    var h = location.hash.slice(1);
    var parts = h.split('/');
    var view = parts[0] || 'practice';
    var id = parts[1] || '';
    // 旧链接兼容：#find → 练习 + 找错题型
    if (view === 'find') {
      view = 'practice';
      state.filter.type = 'find';
      renderFilterChips();
    }
    if (['practice', 'wrong', 'topics', 'about'].indexOf(view) < 0) view = 'practice';
    if (view === 'practice' && id) {
      var f = filteredQuestions();
      var idx = f
        .map(function (q) {
          return q.id;
        })
        .indexOf(id);
      if (idx >= 0) state.cur = idx;
      else gotoQuestion(id);
    }
    setView(view, { noScroll: true });
  }
  window.addEventListener('hashchange', applyRoute);

  /* ---------------- 启动 ---------------- */
  loadState();
  renderFilterChips();
  applyRoute();
  renderStats();
  if (location.hash) renderPracticeStage();
})();
