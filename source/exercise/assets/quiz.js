/* 数分练习题库 · 前端逻辑（无依赖，经典脚本，可离线打开）
 * 数据来自 assets/data.js（构建期已把 KaTeX 渲染成 HTML，运行时不需要公式引擎）
 */
(function () {
  'use strict';

  var D = window.QUIZ_DATA;
  var E = window.QuizEval;
  if (!D) return;

  var LS_DATA = 'gksx-quiz-v1';
  var LS_THEME = 'gksx-quiz-theme';

  var TYPE_NAME = { choice: '选择', expr: '填数值', self: '自评' };
  var LEVEL_NAME = { 1: '基础', 2: '进阶', 3: '综合' };

  var state = {
    view: 'practice',
    progress: {}, // qid -> {status:'ok'|'no', pick, inputs, fieldOk, revealed, ts}
    fe: {}, // feid -> {stepFound, whyOk, tried:[], whyWrong:[], ts}
    filter: { chapter: 'all', type: 'all' },
    feFilter: { chapter: 'all' },
    cur: { practice: 0, find: 0 },
  };

  /* ---------------- 持久化 ---------------- */
  function loadState() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_DATA) || '{}');
      if (raw && typeof raw === 'object') {
        state.progress = raw.progress || {};
        state.fe = raw.fe || {};
      }
    } catch (e) {}
  }
  function saveState() {
    try {
      localStorage.setItem(
        LS_DATA,
        JSON.stringify({ progress: state.progress, fe: state.fe })
      );
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
  function qProg(id) {
    return state.progress[id] || null;
  }
  function feProg(id) {
    return state.fe[id] || null;
  }
  function isCorrectChoice(q) {
    var p = qProg(q.id);
    return !!(p && p.pick === q.key);
  }

  /* ---------------- 列表 / 筛选 ---------------- */
  function filteredQuestions() {
    return D.questions.filter(function (q) {
      if (state.filter.chapter !== 'all' && q.chapter !== state.filter.chapter)
        return false;
      if (state.filter.type !== 'all' && q.type !== state.filter.type)
        return false;
      return true;
    });
  }
  function filteredFind() {
    return D.findErrors.filter(function (f) {
      return (
        state.feFilter.chapter === 'all' ||
        f.chapter === state.feFilter.chapter
      );
    });
  }
  function currentQuestion() {
    var list = filteredQuestions();
    if (!list.length) return null;
    state.cur.practice = clamp(state.cur.practice, 0, list.length - 1);
    return { q: list[state.cur.practice], list: list };
  }
  function currentFind() {
    var list = filteredFind();
    if (!list.length) return null;
    state.cur.find = clamp(state.cur.find, 0, list.length - 1);
    return { fe: list[state.cur.find], list: list };
  }
  function chapterTitle(id) {
    var c = D.chapters.filter(function (x) {
      return x.id === id;
    })[0];
    return c ? c.title : id;
  }

  /* ---------------- 统计 ---------------- */
  function stats() {
    var qs = D.questions;
    var done = 0;
    var ok = 0;
    var bad = 0;
    qs.forEach(function (q) {
      var p = qProg(q.id);
      if (!p) return;
      done++;
      if (p.status === 'ok') ok++;
      else bad++;
    });
    var feDone = 0;
    var feOk = 0;
    D.findErrors.forEach(function (f) {
      var p = feProg(f.id);
      if (p && p.stepFound) feDone++;
      if (p && p.whyOk) feOk++;
    });
    return {
      total: qs.length,
      done: done,
      ok: ok,
      bad: bad,
      rate: done ? Math.round((ok / done) * 100) : 0,
      feTotal: D.findErrors.length,
      feDone: feDone,
      feOk: feOk,
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
    var fs = $('#foot-stats');
    if (fs) {
      fs.textContent =
        '题库 ' +
        s.total +
        ' 题 · 找错 ' +
        s.feTotal +
        ' 题 · 找错进度 ' +
        s.feOk +
        '/' +
        s.feTotal;
    }
    var gp = $('#grid-progress');
    if (gp) gp.textContent = s.done + '/' + s.total;
    var fp = $('#find-progress');
    if (fp) fp.textContent = s.feOk + '/' + s.feTotal;
  }

  /* ---------------- 练习视图 ---------------- */
  function renderChapterChips() {
    var box = $('#chapter-filter');
    if (!box) return;
    var html =
      '<button type="button" class="chip" data-act="filter-chapter" data-ch="all" aria-pressed="' +
      (state.filter.chapter === 'all') +
      '">全部章节</button>';
    D.chapters.forEach(function (c) {
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

    var tbox = $('#type-filter');
    var types = [
      ['all', '全部题型'],
      ['choice', '选择'],
      ['expr', '填数值'],
      ['self', '自评'],
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

  function renderFilterChipsGeneric(sel, group, filterKey, chapters, allLabel) {
    var box = $(sel);
    if (!box) return;
    var html =
      '<button type="button" class="chip" data-act="' +
      group +
      '" data-ch="all" aria-pressed="' +
      (state[filterKey].chapter === 'all') +
      '">' +
      allLabel +
      '</button>';
    chapters.forEach(function (c) {
      html +=
        '<button type="button" class="chip" data-act="' +
        group +
        '" data-ch="' +
        c.id +
        '" aria-pressed="' +
        (state[filterKey].chapter === c.id) +
        '">' +
        c.title.replace(/^第\s*\d+\s*章\s*/, '') +
        '</button>';
    });
    box.innerHTML = html;
  }

  function optionState(q, o) {
    var p = qProg(q.id);
    if (!p) return '';
    if (o.key === q.key) return 'correct';
    if (p.pick === o.key) return 'wrong';
    return 'dim';
  }

  function fieldStateHtml(q, i) {
    var p = qProg(q.id);
    if (!p || !p.fieldOk) return { state: '', msg: '' };
    var ok = p.fieldOk[i];
    return { state: ok ? 'correct' : 'wrong', msg: ok ? '✓ 正确' : '✗ 再算算' };
  }

  function buildInteraction(q) {
    var p = qProg(q.id);
    var html = '';

    if (q.type === 'choice') {
      html += '<div class="options" role="group" aria-label="选项">';
      q.options.forEach(function (o) {
        var st = optionState(q, o);
        html +=
          '<button type="button" class="opt" data-act="pick-option" data-key="' +
          o.key +
          '"' +
          (st ? ' data-state="' + st + '"' : '') +
          (p ? ' disabled' : '') +
          '>' +
          '<span class="okey">' +
          o.key +
          '</span><span class="otext">' +
          o.html +
          '</span></button>';
      });
      html += '</div>';
      if (p) {
        html +=
          '<div class="verdict ' +
          (p.status === 'ok' ? 'ok' : 'no') +
          '">' +
          (p.status === 'ok'
            ? '✓ 答对了'
            : '✗ 正确答案是 ' + q.key) +
          '</div>';
      }
      html +=
        '<div class="actions">' +
        (p
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
          '>' +
          '<label>' +
          (f.label ? f.label : '你的答案') +
          '</label>' +
          '<input type="text" autocomplete="off" spellcheck="false" inputmode="text" placeholder="如 3/4、e^-4" value="' +
          (p && p.inputs && p.inputs[i] ? String(p.inputs[i]).replace(/"/g, '&quot;') : '') +
          '" />' +
          '<span class="fmsg">' +
          fs.msg +
          '</span>' +
          '</div>';
      });
      html += '</div>';
      html +=
        '<div class="actions">' +
        '<button type="button" class="btn primary" data-act="submit-expr">' +
        (p ? '再提交' : '提交') +
        '</button>' +
        '<span class="hint">支持 <code>3/4</code>、<code>e^-4</code>、<code>100!</code>、<code>sqrt(2)</code>，也可直接粘 LaTeX 如 <code>\\frac{1}{12}</code></span>' +
        '</div>';
      if (p) {
        html +=
          '<div class="verdict ' +
          (p.status === 'ok' ? 'ok' : 'no') +
          '">' +
          (p.status === 'ok' ? '✓ 全部答对' : '✗ 还有空没对，改一改再提交') +
          '</div>';
      }
      html +=
        '<div class="actions">' +
        (p
          ? '<button type="button" class="btn ghost" data-act="retry">清空重做</button>'
          : '') +
        '</div>';
    } else {
      // self 自评
      if (!p || !p.revealed) {
        html +=
          '<div class="actions">' +
          '<button type="button" class="btn primary" data-act="reveal">先自己算，再看答案</button>' +
          '<span class="hint">点击后展开完整解析，对照自评</span>' +
          '</div>';
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
            '<button type="button" class="btn danger" data-act="self-bad">我算错了</button>' +
            '</div>';
        } else {
          html +=
            '<div class="actions">' +
            '<button type="button" class="btn ghost" data-act="retry">重做这题</button>' +
            '</div>';
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
          '">' +
          '<span class="note-label">' +
          n.label +
          '</span>' +
          '<div>' +
          n.html +
          '</div></div>'
        );
      })
      .join('');
  }

  function renderPracticeStage() {
    var stage = $('#stage');
    if (!stage) return;
    var cur = currentQuestion();
    if (!cur) {
      stage.innerHTML =
        '<div class="empty">这个筛选下没有题目，换个章节或题型试试。</div>';
      renderGrid();
      return;
    }
    var q = cur.q;
    var p = qProg(q.id);
    var showSol = !!(
      p &&
      (q.type !== 'self' || p.revealed)
    );
    var head =
      '<header class="q-head">' +
      '<span class="qno">宋 ' +
      q.no +
      '</span>' +
      '<span class="tag type">' +
      TYPE_NAME[q.type] +
      '</span>' +
      '<span class="tag level">' +
      (LEVEL_NAME[q.level] || '') +
      '</span>' +
      '<span class="q-topic">' +
      q.topic +
      '</span>' +
      '</header>';

    var html =
      '<article class="card" data-qid="' +
      q.id +
      '">' +
      head +
      '<div class="q-body">' +
      q.stemHtml +
      '</div>' +
      buildInteraction(q) +
      '<div class="solution" data-sol' +
      (showSol ? '' : ' hidden') +
      '>' +
      '<div class="sol-head">答案与解析</div>' +
      '<div class="sol-body">' +
      q.answerHtml +
      '</div>' +
      buildNotes(q) +
      '</div>' +
      '<div class="pager">' +
      '<button type="button" class="btn ghost" data-act="prev"' +
      (state.cur.practice === 0 ? ' disabled' : '') +
      '>← 上一题</button>' +
      '<span class="pos">' +
      (state.cur.practice + 1) +
      ' / ' +
      cur.list.length +
      ' · ' +
      chapterTitle(q.chapter) +
      '</span>' +
      '<button type="button" class="btn ghost" data-act="next"' +
      (state.cur.practice >= cur.list.length - 1 ? ' disabled' : '') +
      '>下一题 →</button>' +
      '</div>' +
      '</article>';
    stage.innerHTML = html;
    renderGrid();
  }

  function renderGrid() {
    var grid = $('#qgrid');
    if (!grid) return;
    var list = filteredQuestions();
    var cur = list[state.cur.practice];
    grid.innerHTML = list
      .map(function (q, i) {
        var p = qProg(q.id);
        var cls = 'gcell';
        if (p) cls += p.status === 'ok' ? ' ok' : ' no';
        if (cur && cur.id === q.id) cls += ' cur';
        return (
          '<button type="button" class="' +
          cls +
          '" data-act="goto-q" data-idx="' +
          i +
          '" title="宋 ' +
          q.no +
          ' · ' +
          q.topic +
          '">' +
          q.no +
          '</button>'
        );
      })
      .join('');
  }

  /* ---------------- 找错视图 ---------------- */
  function renderFindStage() {
    var stage = $('#find-stage');
    if (!stage) return;
    var cur = currentFind();
    if (!cur) {
      stage.innerHTML = '<div class="empty">这个章节下暂时没有找错题。</div>';
      renderFeGrid();
      return;
    }
    var fe = cur.fe;
    var p = feProg(fe.id) || {};
    var tried = p.tried || [];
    var whyWrong = p.whyWrong || [];
    var stepHtml = fe.stepsHtml
      .map(function (s, i) {
        var st = '';
        if (p.stepFound && i === fe.wrong) st = 'found';
        else if (tried.indexOf(i) >= 0) st = 'excluded';
        var mark = st === 'found' ? '就是这一步' : st === 'excluded' ? '没问题' : '';
        return (
          '<button type="button" class="step" data-act="fe-step" data-i="' +
          i +
          '"' +
          (st ? ' data-state="' + st + '"' : '') +
          (p.stepFound ? ' disabled' : '') +
          '>' +
          '<span class="sno">' +
          (i + 1) +
          '</span>' +
          '<span class="stext">' +
          s +
          '</span>' +
          '<span class="smark">' +
          mark +
          '</span></button>'
        );
      })
      .join('');

    var whyHtml = fe.whyOptions
      .map(function (o) {
        var st = '';
        if (p.whyOk && o.key === fe.why) st = 'correct';
        else if (whyWrong.indexOf(o.key) >= 0) st = 'wrong';
        return (
          '<button type="button" class="why" data-act="fe-why" data-key="' +
          o.key +
          '"' +
          (st ? ' data-state="' + st + '"' : '') +
          (p.whyOk ? ' disabled' : '') +
          '>' +
          '<span class="wkey">' +
          o.key +
          '</span><span>' +
          o.html +
          '</span></button>'
        );
      })
      .join('');

    var verdict = '';
    if (p.stepFound && !p.whyOk) {
      verdict = '<div class="verdict mid">✓ 第 ' + (fe.wrong + 1) + ' 步确实有问题 —— 再选出错因</div>';
    } else if (p.whyOk) {
      verdict = '<div class="verdict ok">✓ 找到错误步骤，并选对了错因</div>';
    } else if (tried.length) {
      verdict = '<div class="verdict no">已排除 ' + tried.length + ' 步，继续找</div>';
    }

    stage.innerHTML =
      '<article class="card" data-feid="' +
      fe.id +
      '">' +
      '<header class="q-head">' +
      '<span class="qno">找错 ' +
      fe.order +
      '</span>' +
      '<span class="tag type">找错</span>' +
      '<span class="tag level">' +
      (LEVEL_NAME[fe.level] || '') +
      '</span>' +
      (fe.related ? '<span class="tag">改编自宋 ' + fe.related + '</span>' : '') +
      '<span class="q-topic">' +
      fe.topic +
      '</span>' +
      '</header>' +
      '<h2 class="fe-title">' +
      fe.title +
      '</h2>' +
      '<div class="fe-prompt">' +
      fe.promptHtml +
      '</div>' +
      '<div class="hint" style="margin-bottom:8px">点一下你认为出错的那一步：</div>' +
      '<div class="steps">' +
      stepHtml +
      '</div>' +
      verdict +
      '<div class="why-box" data-whybox' +
      (p.stepFound ? '' : ' hidden') +
      '>' +
      '<p class="why-title">错因是哪一个？</p>' +
      '<div class="why-list">' +
      whyHtml +
      '</div>' +
      '</div>' +
      '<div class="solution" data-sol' +
      (p.whyOk ? '' : ' hidden') +
      '>' +
      '<div class="sol-head">正解与要点</div>' +
      '<div class="sol-body">' +
      fe.explainHtml +
      '</div>' +
      '</div>' +
      '<div class="pager">' +
      '<button type="button" class="btn ghost" data-act="fe-prev"' +
      (state.cur.find === 0 ? ' disabled' : '') +
      '>← 上一题</button>' +
      '<span class="pos">' +
      (state.cur.find + 1) +
      ' / ' +
      cur.list.length +
      '</span>' +
      '<button type="button" class="btn ghost" data-act="fe-next"' +
      (state.cur.find >= cur.list.length - 1 ? ' disabled' : '') +
      '>下一题 →</button>' +
      '</div>' +
      '</article>';
    renderFeGrid();
  }

  function renderFeGrid() {
    var grid = $('#fegrid');
    if (!grid) return;
    var list = filteredFind();
    var cur = list[state.cur.find];
    grid.innerHTML = list
      .map(function (f, i) {
        var p = feProg(f.id);
        var cls = 'gcell';
        if (p && p.whyOk) cls += ' ok';
        else if (p && p.stepFound) cls += ' mid';
        if (cur && cur.id === f.id) cls += ' cur';
        return (
          '<button type="button" class="' +
          cls +
          '" data-act="goto-fe" data-idx="' +
          i +
          '" title="' +
          f.title +
          '">' +
          f.order +
          '</button>'
        );
      })
      .join('');
  }

  /* ---------------- 错题本 ---------------- */
  function renderWrong() {
    var box = $('#wrong-list');
    if (!box) return;
    var items = D.questions.filter(function (q) {
      var p = qProg(q.id);
      return p && p.status === 'no';
    });
    if (!items.length) {
      box.innerHTML =
        '<div class="empty">错题本是空的 —— 去「练习」里答几题吧。<br /><span class="hint">答错或自评「算错了」的题会自动收进来。</span></div>';
      return;
    }
    box.innerHTML = items
      .map(function (q) {
        return (
          '<div class="wrong-item">' +
          '<div class="wi-main">' +
          '<div class="wi-title">' +
          htmlToText(q.stemHtml).slice(0, 120) +
          '</div>' +
          '<div class="wi-meta">宋 ' +
          q.no +
          ' · ' +
          q.topic +
          ' · <span class="badge-kind">' +
          TYPE_NAME[q.type] +
          '</span></div>' +
          '</div>' +
          '<button type="button" class="btn primary" data-act="goto-qid" data-qid="' +
          q.id +
          '">去重做</button>' +
          '</div>'
        );
      })
      .join('');
  }

  /* ---------------- 知识点 ---------------- */
  function renderTopics() {
    var box = $('#topics-list');
    if (!box) return;
    var html = '';
    D.chapters.forEach(function (ch) {
      var qs = D.questions.filter(function (q) {
        return q.chapter === ch.id;
      });
      if (!qs.length) return;
      // 按首次出现顺序聚合 topic
      var order = [];
      var map = {};
      qs.forEach(function (q) {
        if (!map[q.topic]) {
          map[q.topic] = [];
          order.push(q.topic);
        }
        map[q.topic].push(q);
      });
      html +=
        '<div class="topic-chapter"><h3>' +
        ch.title +
        '<small>' +
        ch.sub +
        ' · ' +
        qs.length +
        ' 题</small></h3>';
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
              '<div class="topic-point"><span class="tp-from">宋 ' +
                q.no +
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
          (ti === 0 ? ' open' : '') +
          '><summary>' +
          topic +
          '<span class="tcount">' +
          list.length +
          ' 题</span></summary>' +
          '<div class="topic-body">' +
          (points.length
            ? points.join('')
            : '<p class="hint">这道题的小结见题目解析（点下方题号查看）。</p>') +
          '<div class="qlinks">' +
          list
            .map(function (q) {
              return (
                '<button type="button" class="qlink" data-act="goto-qid" data-qid="' +
                q.id +
                '">宋 ' +
                q.no +
                '</button>'
              );
            })
            .join('') +
          '</div></div></details>';
      });
      html += '</div>';
    });
    box.innerHTML = html || '<div class="empty">暂无知识点。</div>';
  }

  /* ---------------- 视图切换 ---------------- */
  function setView(view, opts) {
    opts = opts || {};
    if (['practice', 'find', 'wrong', 'topics', 'about'].indexOf(view) < 0)
      view = 'practice';
    state.view = view;
    $$('.tab').forEach(function (t) {
      t.setAttribute('aria-selected', String(t.dataset.view === view));
    });
    $$('.view').forEach(function (v) {
      v.classList.toggle('active', v.id === 'view-' + view);
    });
    if (view === 'practice') renderPracticeStage();
    if (view === 'find') renderFindStage();
    if (view === 'wrong') renderWrong();
    if (view === 'topics') renderTopics();
    renderStats();
    if (!opts.noScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function gotoQuestion(qid) {
    var list = D.questions;
    var idxAll = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === qid) {
        idxAll = i;
        break;
      }
    }
    if (idxAll < 0) return;
    // 保证该题在当前筛选结果里
    var f = filteredQuestions();
    var idx = f.map(function (q) {
      return q.id;
    }).indexOf(qid);
    if (idx < 0) {
      state.filter.chapter = 'all';
      state.filter.type = 'all';
      renderChapterChips();
      f = filteredQuestions();
      idx = f.map(function (q) {
        return q.id;
      }).indexOf(qid);
    }
    state.cur.practice = Math.max(0, idx);
    setView('practice');
  }

  /* ---------------- 作答逻辑 ---------------- */
  function recordAnswer(qid, patch) {
    var p = state.progress[qid] || {};
    for (var k in patch) p[k] = patch[k];
    p.ts = Date.now();
    state.progress[qid] = p;
    saveState();
    renderStats();
  }

  function pickOption(q, key) {
    var p = qProg(q.id);
    if (p) return;
    recordAnswer(q.id, {
      pick: key,
      status: key === q.key ? 'ok' : 'no',
    });
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

  function retry(qid, isFind) {
    if (isFind) {
      delete state.fe[qid];
    } else {
      delete state.progress[qid];
    }
    saveState();
    if (isFind) renderFindStage();
    else renderPracticeStage();
    renderStats();
  }

  /* ---------------- 找错作答 ---------------- */
  function feStep(id, i) {
    var fe = D.findErrors.filter(function (f) {
      return f.id === id;
    })[0];
    var p = state.fe[id] || { tried: [], whyWrong: [] };
    p.tried = p.tried || [];
    if (i === fe.wrong) {
      p.stepFound = true;
    } else if (p.tried.indexOf(i) < 0) {
      p.tried.push(i);
    }
    p.ts = Date.now();
    state.fe[id] = p;
    saveState();
    renderFindStage();
  }

  function feWhy(id, key) {
    var fe = D.findErrors.filter(function (f) {
      return f.id === id;
    })[0];
    var p = state.fe[id] || {};
    p.whyWrong = p.whyWrong || [];
    if (key === fe.why) {
      p.whyOk = true;
    } else if (p.whyWrong.indexOf(key) < 0) {
      p.whyWrong.push(key);
    }
    p.ts = Date.now();
    state.fe[id] = p;
    saveState();
    renderFindStage();
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
    var t = e.target.closest ? e.target.closest('[data-act]') : null;

    // 标签页
    var tab = e.target.closest ? e.target.closest('.tab') : null;
    if (tab) {
      var v = tab.dataset.view;
      if (location.hash.slice(1).split('/')[0] !== v) location.hash = v;
      else setView(v);
      return;
    }
    if (!t) return;
    var act = t.dataset.act;

    if (act === 'theme') return toggleTheme();

    if (act === 'filter-chapter') {
      state.filter.chapter = t.dataset.ch;
      state.cur.practice = 0;
      renderChapterChips();
      renderPracticeStage();
      return;
    }
    if (act === 'filter-type') {
      state.filter.type = t.dataset.type;
      state.cur.practice = 0;
      renderChapterChips();
      renderPracticeStage();
      return;
    }
    if (act === 'find-chapter') {
      state.feFilter.chapter = t.dataset.ch;
      state.cur.find = 0;
      renderFilterChipsGeneric(
        '#find-chapter-filter',
        'find-chapter',
        'feFilter',
        D.chapters,
        '全部章节'
      );
      renderFindStage();
      return;
    }
    if (act === 'goto-q') {
      state.cur.practice = Number(t.dataset.idx) || 0;
      renderPracticeStage();
      return;
    }
    if (act === 'goto-qid') {
      gotoQuestion(t.dataset.qid);
      return;
    }
    if (act === 'goto-fe') {
      state.cur.find = Number(t.dataset.idx) || 0;
      renderFindStage();
      return;
    }
    if (act === 'prev') {
      state.cur.practice = Math.max(0, state.cur.practice - 1);
      renderPracticeStage();
      return;
    }
    if (act === 'next') {
      state.cur.practice = Math.min(
        filteredQuestions().length - 1,
        state.cur.practice + 1
      );
      renderPracticeStage();
      return;
    }
    if (act === 'fe-prev') {
      state.cur.find = Math.max(0, state.cur.find - 1);
      renderFindStage();
      return;
    }
    if (act === 'fe-next') {
      state.cur.find = Math.min(
        filteredFind().length - 1,
        state.cur.find + 1
      );
      renderFindStage();
      return;
    }
    if (act === 'random') {
      var list = filteredQuestions();
      if (list.length > 1) {
        var n = state.cur.practice;
        while (n === state.cur.practice)
          n = Math.floor(Math.random() * list.length);
        state.cur.practice = n;
      }
      renderPracticeStage();
      return;
    }
    if (act === 'reset') {
      if (window.confirm('清空本机的作答进度、错题本和找错记录？')) {
        state.progress = {};
        state.fe = {};
        saveState();
        renderPracticeStage();
        renderFindStage();
        renderWrong();
        renderStats();
      }
      return;
    }

    // 题卡内动作
    var card = t.closest('.card');
    if (!card) return;
    var qid = card.dataset.qid;
    var feid = card.dataset.feid;

    if (act === 'pick-option' && qid) {
      var q = D.questions.filter(function (x) {
        return x.id === qid;
      })[0];
      pickOption(q, t.dataset.key);
      return;
    }
    if (act === 'submit-expr' && qid) {
      var q2 = D.questions.filter(function (x) {
        return x.id === qid;
      })[0];
      submitExpr(q2);
      return;
    }
    if (act === 'reveal' && qid) {
      recordAnswer(qid, { revealed: true });
      renderPracticeStage();
      return;
    }
    if (act === 'self-ok' && qid) {
      recordAnswer(qid, { status: 'ok', revealed: true });
      renderPracticeStage();
      return;
    }
    if (act === 'self-bad' && qid) {
      recordAnswer(qid, { status: 'no', revealed: true });
      renderPracticeStage();
      return;
    }
    if (act === 'retry' && qid) {
      delete state.progress[qid];
      saveState();
      renderPracticeStage();
      renderStats();
      return;
    }
    if (act === 'fe-step' && feid) {
      feStep(feid, Number(t.dataset.i));
      return;
    }
    if (act === 'fe-why' && feid) {
      feWhy(feid, t.dataset.key);
      return;
    }
  });

  // 主题按钮（顶栏）
  var themeBtn = $('#theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // 键盘
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    var inInput = tag === 'input' || tag === 'textarea';

    if (e.key === 'Enter' && inInput) {
      var card = e.target.closest('.card');
      if (card) {
        var btn = $('[data-act="submit-expr"]', card);
        if (btn) {
          e.preventDefault();
          btn.click();
        }
      }
      return;
    }
    if (inInput) return;
    var card2 = $('.card');
    if (!card2) return;

    if (e.key === 'ArrowLeft' && card2.dataset.qid) {
      var prev = $('[data-act="prev"]');
      if (prev && !prev.disabled) prev.click();
      else if (card2.dataset.feid) {
        var pv = $('[data-act="fe-prev"]');
        if (pv && !pv.disabled) pv.click();
      }
    } else if (e.key === 'ArrowRight' && card2.dataset.qid) {
      var nx = $('[data-act="next"]');
      if (nx && !nx.disabled) nx.click();
    } else if (e.key === 'ArrowRight' && card2.dataset.feid) {
      var fn = $('[data-act="fe-next"]');
      if (fn && !fn.disabled) fn.click();
    } else if (e.key === 'ArrowLeft' && card2.dataset.feid) {
      var fp = $('[data-act="fe-prev"]');
      if (fp && !fp.disabled) fp.click();
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
    if (['practice', 'find', 'wrong', 'topics', 'about'].indexOf(view) < 0)
      view = 'practice';
    if (view === 'practice' && id) {
      var f = filteredQuestions();
      var idx = f.map(function (q) {
        return q.id;
      }).indexOf(id);
      if (idx >= 0) state.cur.practice = idx;
      else {
        state.filter.chapter = 'all';
        state.filter.type = 'all';
        renderChapterChips();
        var f2 = filteredQuestions();
        var i2 = f2.map(function (q) {
          return q.id;
        }).indexOf(id);
        if (i2 >= 0) state.cur.practice = i2;
      }
    }
    if (view === 'find' && id) {
      var l = filteredFind();
      var fi = l.map(function (f) {
        return f.id;
      }).indexOf(id);
      if (fi >= 0) state.cur.find = fi;
    }
    setView(view, { noScroll: true });
  }
  window.addEventListener('hashchange', applyRoute);

  /* ---------------- 启动 ---------------- */
  loadState();
  renderChapterChips();
  renderFilterChipsGeneric(
    '#find-chapter-filter',
    'find-chapter',
    'feFilter',
    D.chapters,
    '全部章节'
  );
  applyRoute();
  renderStats();
  if (location.hash) renderPracticeStage();
})();
