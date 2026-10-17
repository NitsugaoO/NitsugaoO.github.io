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
 *   3. 页脚左侧 → 插入二次元动图挂件（图不存在时静默隐藏）
 *   4. 侧栏歌词卡 → 读取 LRC，用自走时钟按原曲速度滚动，可暂停 / 换歌
 * ========================================================================= */

(function () {
  'use strict';

  /* 自我介绍页地址（source/about/index.md） */
  var ABOUT_URL = '/about/';

  /* 页脚的二次元动图：把文件放到 source/img/ 下即可生效。
     换图、换路径只改这一行。
     当前图：**透明背景**的立绘动画（原图 1920×1080 / 84 帧 / 30.7MB），
     整幅未裁剪，压缩为 400×225 / 10fps / 658KB（保持 alpha 通道）。 */
  var MASCOT_SRC = '/img/mascot.webp';

  /* 歌词视窗可见行数 */
  var LYRIC_ROWS = 3;

  /* 时钟刷新间隔(ms)：200 表示每秒算 5 次当前时间，对逐行歌词绰绰有余 */
  var LYRIC_TICK = 200;

  /* 自动跳过前奏：从第一句歌词前几秒开始（《贝加尔湖畔》有 48 秒前奏） */
  var LYRIC_LEAD_IN = 3;

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

  /* 秒 → m:ss */
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
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

  /* ---- 3. 页脚的二次元动图 ---------------------------------------------- */
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

  /* ==========================================================================
   * 4. 侧栏歌词卡
   * --------------------------------------------------------------------------
   * 数据来自 source/js/lyrics-data.js（window.WOOYUN_LYRICS）。
   *
   * 「按原曲速度」是怎么做到的：
   *   没有音频，所以时间由自己走 —— 点开就用 performance.now() 起一个时钟，
   *   每 200ms 拿「当前秒数」去 LRC 时间轴里查该高亮哪一行，歌词按真实时间戳
   *   滚动、进度条按原曲时长推进。也就是说它相当于一个「无声播放器」，
   *   歌词与真实听歌的时间轴一致，只是耳机里没声音。
   * ========================================================================== */

  /* [mm:ss.xx] —— 也兼容 [mm:ss:xx] 这种少见写法 */
  var LRC_TIME = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;

  /* LRC 头部混着「作词 : 李健」这类元信息，它们不该当歌词显示 */
  var LRC_META = /^(作词|作曲|编曲|制作人|混音|母带|吉他|贝斯|鼓|键盘|录音|出品|发行|监制|统筹|和声|弦乐|企划|词|曲|OP|SP)\s*[:：]/;

  /* LRC 文本 → [{ time: 48.2, text: '在我的怀里 在你的眼里' }]  （按时间升序） */
  function parseLrc(text) {
    var out = [];

    text.split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;

      /* 一行可能挂多个时间戳（重复段落），全部收集 */
      var times = [];
      var m;
      LRC_TIME.lastIndex = 0;
      while ((m = LRC_TIME.exec(line)) !== null) {
        times.push(parseInt(m[1], 10) * 60 + parseFloat(m[2].replace(':', '.')));
      }
      if (!times.length) return;

      var content = line.replace(LRC_TIME, '').trim();
      if (!content) return;                  // 纯时间戳 = 间奏，跳过
      if (LRC_META.test(content)) return;    // 元信息，跳过

      times.forEach(function (t) { out.push({ time: t, text: content }); });
    });

    out.sort(function (a, b) { return a.time - b.time; });
    return out;
  }

  function initLyricsCard() {
    var songs = window.WOOYUN_LYRICS;
    if (!songs || !songs.length) return;   // 没歌单就不动，保留 widget.yml 里的兜底内容

    whenReady('#lyrics-root', function (root) {
      var current = -1;
      var stopPlayer = null;   // 当前播放器的清理函数，切歌前必须先停

      /* 行高的实测值（字号/字体变化都能跟上）；侧栏在移动端若处于隐藏状态
         会测得 0，此时退回计算样式里的 line-height。 */
      function rowHeight(rows) {
        var h = rows[0] ? rows[0].getBoundingClientRect().height : 0;
        if (!h && rows[0]) h = parseFloat(window.getComputedStyle(rows[0]).lineHeight) || 0;
        return h || 24;
      }

      /* ---- 时间轴播放器：无声，但时间是真的 ---------------------------- */
      function playTimeline(refs, timeline, duration) {
        var rows = refs.rows;
        var start = Math.max(0, timeline[0].time - LYRIC_LEAD_IN);   // 跳前奏
        var base = start;      // 时钟基准（秒）
        var t0 = 0;            // performance.now() 对应 base 的那一刻
        var playing = false;
        var timer = null;
        var active = -1;

        function elapsed() {
          return playing ? base + (window.performance.now() - t0) / 1000 : base;
        }

        function indexAt(t) {
          var i = -1;
          for (var k = 0; k < timeline.length; k++) {
            if (timeline[k].time <= t) i = k; else break;
          }
          return i;
        }

        /* 高亮第 i 行，并把它挪到视窗中间（首尾夹住，避免露出空白） */
        function paint(i) {
          if (i === active) return;
          active = i;

          for (var k = 0; k < rows.length; k++) {
            rows[k].classList.toggle('is-active', k === i);
          }

          var middle = (LYRIC_ROWS - 1) >> 1;
          var max = Math.max(0, rows.length - LYRIC_ROWS);
          var top = Math.min(Math.max(i - middle, 0), max);
          refs.track.style.transform = 'translateY(' + (-top * rowHeight(rows)) + 'px)';
        }

        function tick() {
          var t = elapsed();

          /* 唱完一轮就回到起点重新开始（歌词卡是装饰，循环比停住好） */
          if (t >= duration) { seek(start); return; }

          paint(indexAt(t));
          refs.bar.style.width = (t / duration * 100) + '%';
          refs.time.textContent = fmtTime(t) + ' / ' + fmtTime(duration);
        }

        function seek(t) {
          base = t;
          t0 = window.performance.now();
          active = -1;
          tick();
        }

        function play() {
          if (playing) return;
          playing = true;
          t0 = window.performance.now();
          refs.toggle.innerHTML = '<i class="fas fa-pause"></i>';
          refs.toggle.setAttribute('aria-label', '暂停');
          timer = window.setInterval(tick, LYRIC_TICK);
          tick();
        }

        function pause() {
          if (!playing) return;
          base = base + (window.performance.now() - t0) / 1000;   // 把时间冻在当前这一刻
          playing = false;
          refs.toggle.innerHTML = '<i class="fas fa-play"></i>';
          refs.toggle.setAttribute('aria-label', '播放');
          if (timer) { window.clearInterval(timer); timer = null; }
        }

        refs.toggle.addEventListener('click', function () {
          if (playing) { pause(); } else { play(); }
        });

        seek(start);
        play();

        return function () {
          playing = false;
          if (timer) { window.clearInterval(timer); timer = null; }
        };
      }

      /* ---- 没有 LRC 时的降级：静态显示开头几行 ------------------------- */
      function paintStatic(refs) {
        refs.track.style.transform = 'translateY(0)';
        if (refs.rows[0]) refs.rows[0].classList.add('is-active');
      }

      /* ---- 把某一首歌渲染进卡片 ---------------------------------------- */
      function build(song, timeline) {
        if (stopPlayer) { stopPlayer(); stopPlayer = null; }

        var texts = timeline
          ? timeline.map(function (l) { return l.text; })
          : (song.lines || []).slice(0, LYRIC_ROWS);

        var track = document.createElement('div');
        track.className = 'lyrics-track';
        texts.forEach(function (text) {
          var p = document.createElement('p');
          p.className = 'lyric-line';
          p.textContent = text;
          track.appendChild(p);
        });

        var viewport = document.createElement('div');
        viewport.className = 'lyrics-viewport';
        viewport.appendChild(track);

        var refs = { track: track, rows: track.children };

        var root2 = document.createDocumentFragment();
        root2.appendChild(viewport);

        /* 控制行：只有拿到时间轴才出现 */
        if (timeline) {
          var toggle = document.createElement('button');
          toggle.className = 'lyrics-toggle';
          toggle.type = 'button';
          toggle.innerHTML = '<i class="fas fa-play"></i>';
          toggle.setAttribute('aria-label', '播放');

          var progress = document.createElement('div');
          progress.className = 'lyrics-progress';
          var bar = document.createElement('div');
          bar.className = 'lyrics-progress-bar';
          progress.appendChild(bar);

          var time = document.createElement('span');
          time.className = 'lyrics-time';

          var control = document.createElement('div');
          control.className = 'lyrics-control';
          control.appendChild(toggle);
          control.appendChild(progress);
          control.appendChild(time);
          root2.appendChild(control);

          refs.toggle = toggle;
          refs.bar = bar;
          refs.time = time;
        }

        /* 底部：歌名（点了去网易云）+ 换一首（歌单超过一首才出现） */
        var link = document.createElement('a');
        link.className = 'lyrics-source';
        link.href = song.url || '#';
        link.target = '_blank';
        link.rel = 'noopener';
        link.innerHTML = '<i class="fas fa-headphones"></i> ';
        link.appendChild(document.createTextNode(song.title + ' · ' + song.artist));

        var foot = document.createElement('div');
        foot.className = 'lyrics-foot';
        foot.appendChild(link);

        if (songs.length > 1) {
          var btn = document.createElement('button');
          btn.className = 'lyrics-shuffle';
          btn.type = 'button';
          btn.title = '换一首';
          btn.setAttribute('aria-label', '换一首');
          btn.innerHTML = '<i class="fas fa-random"></i>';
          btn.addEventListener('click', function () {
            var next = current;
            while (next === current) next = Math.floor(Math.random() * songs.length);
            show(next);
          });
          foot.appendChild(btn);
        }

        root2.appendChild(foot);

        root.innerHTML = '';
        root.appendChild(root2);

        if (timeline) {
          /* 时长：优先用数据里的 duration，否则拿最后一句 + 8 秒收尾 */
          var duration = song.duration || (timeline[timeline.length - 1].time + 8);
          stopPlayer = playTimeline(refs, timeline, duration);
        } else {
          paintStatic(refs);
        }
      }

      /* ---- 切到第 index 首歌 -------------------------------------------- */
      function show(index) {
        current = index;
        var song = songs[index];

        if (stopPlayer) { stopPlayer(); stopPlayer = null; }

        if (!song.lrc) { build(song, null); return; }

        root.innerHTML = '<p class="lyrics-loading">加载歌词…</p>';

        /* 记下这一轮是给第几首歌发的请求：若用户又快速切了歌，
           晚回来的旧响应就不能再覆盖新内容。 */
        var token = index;

        window.fetch(song.lrc)
          .then(function (res) {
            if (!res.ok) throw new Error(res.status);
            return res.text();
          })
          .then(function (text) {
            if (token !== current) return;
            var timeline = parseLrc(text);
            build(song, timeline.length ? timeline : null);
          })
          .catch(function () {
            if (token !== current) return;
            /* 拿不到 LRC 也不要留白：退回纯文本歌词 */
            build(song, null);
          });
      }

      show(0);   /* 从第一首开始；随机留给「换一首」按钮 */
    });
  }

  /* ==========================================================================
   * 5. 把歌词卡挪到目录下方
   * --------------------------------------------------------------------------
   * 侧栏模板把卡片分成两块：作者卡 + card_top_self 在 .sticky_layout **外面**
   * （滚动就跟着跑掉），而目录在 .sticky_layout 里面（会吸附、一直可见）。
   * 歌词卡要「随时都能在右边看到」，就只能搬进 sticky_layout，且排在目录后面。
   * 首页/归档没有目录，那就放到 sticky_layout 开头，同样能跟着吸附。
   * ========================================================================== */
  function placeLyricsCard() {
    var card = document.getElementById('card-lyrics');
    if (!card) return;   // 没配这张卡就不管

    var toc = document.querySelector('#aside-content #card-toc');
    var sticky = document.querySelector('#aside-content .sticky_layout');

    if (toc && toc.parentNode) {
      toc.parentNode.insertBefore(card, toc.nextSibling);
    } else if (sticky && sticky.firstChild !== card) {
      sticky.insertBefore(card, sticky.firstChild);
    }
  }

  /* ---- 6. 文章里的分类 / 标签链接 → 文章库筛选 ------------------------- */
  /* 主题给文章元信息渲染了指向 /categories/ 和 /tags/ 的链接。
     现在分类和标签都统一由「文章库」承载，把这些链接改成
     /library/?cat=... 与 /library/?tag=...。

     ⚠️ 首页卡片和文章页用的是**两套不同的 class**：
       首页卡片：a.article-meta__categories（首页不显示标签）
       文章页：  a.post-meta-categories + a.post-meta__tags
     分类可能是多级的（数学分析 › 第一章），所以要按容器分组、
     逐个累加出完整路径，否则子分类链接只带自己那一级、匹配不上。 */
  function linkMetaToLibrary() {
    var i;

    /* --- 标签：一对一，直接改 --- */
    var tags = document.querySelectorAll('a.article-meta__tags, a.post-meta__tags');
    for (i = 0; i < tags.length; i++) {
      tags[i].href = '/library/?tag=' + encodeURIComponent(tags[i].textContent.trim());
    }

    /* --- 分类：按容器分组累加层级 --- */
    function upgradeCategories(linkSelector, groupSelector) {
      var groups = document.querySelectorAll(groupSelector);
      for (var g = 0; g < groups.length; g++) {
        var links = groups[g].querySelectorAll(linkSelector);
        var path = [];
        for (var k = 0; k < links.length; k++) {
          path.push(links[k].textContent.trim());
          links[k].href = '/library/?cat=' + encodeURIComponent(path.join('/'));
        }
      }
    }

    upgradeCategories('a.article-meta__categories', 'span.article-meta');
    upgradeCategories('a.post-meta-categories', 'span.post-meta-categories');

    /* --- 侧栏标签云：同样指向文章库筛选 --- */
    var cloud = document.querySelectorAll('#aside-content .card-tag-cloud a');
    for (i = 0; i < cloud.length; i++) {
      cloud[i].href = '/library/?tag=' + encodeURIComponent(cloud[i].textContent.trim());
    }
  }

  /* ---- 入口 ------------------------------------------------------------- */
  function init() {
    linkAuthorName();
    initMotto();
    addFooterMascot();
    initLyricsCard();
    linkMetaToLibrary();
    whenReady('#aside-content', placeLyricsCard);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
