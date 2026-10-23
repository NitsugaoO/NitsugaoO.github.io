/* ============================================================================
 * 歌曲页面（/songs/）
 * ----------------------------------------------------------------------------
 * 数据来自 /site.json 的 lyrics（source/_data/lyrics.yml）。
 * 只在这个页面生效：找不到 #songs-root 就直接返回。
 *
 * 每首歌展示：歌名、歌手、时长、添加时间、感想。
 * 「歌词」按钮会按需 fetch LRC 并把时间戳去掉后展示。
 * shuffle: false 的歌会标上「不随机」——它们不会出现在侧栏歌词卡的「换一首」里。
 * ========================================================================= */

(function () {
  'use strict';

  var root = document.getElementById('songs-root');
  if (!root) return;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function fmtDuration(sec) {
    var total = Number(sec) || 0;
    if (!total) return '';
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  /* LRC → 纯歌词行（去掉时间戳和 [ti:] 这类元信息） */
  function lrcToLines(text) {
    var out = [];
    String(text || '').split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      if (/^\[[a-zA-Z]+:/.test(line)) return;

      var matched = line.match(/^\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]\s*(.*)$/);
      if (matched) {
        if (matched[1]) out.push(matched[1]);
        return;
      }
      out.push(line);
    });
    return out;
  }

  function buildCard(song) {
    var card = el('article', 'song-card');

    var head = el('div', 'song-card-head');
    head.appendChild(el('h3', 'song-card-title', song.title || '（未命名）'));
    if (song.artist) head.appendChild(el('span', 'song-card-artist', song.artist));

    var meta = [];
    if (song.duration) meta.push(fmtDuration(song.duration));
    if (song.added) meta.push('添加于 ' + String(song.added).slice(0, 10));
    if (meta.length) head.appendChild(el('span', 'song-card-meta', meta.join(' · ')));

    if (song.shuffle === false) head.appendChild(el('span', 'song-card-badge', '不随机'));
    card.appendChild(head);

    if (song.note) {
      card.appendChild(el('p', 'song-note', song.note));
    }

    var actions = el('div', 'song-actions');
    if (song.url) {
      var link = document.createElement('a');
      link.className = 'song-link';
      link.href = song.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.appendChild(el('i', 'fas fa-headphones'));
      link.appendChild(document.createTextNode(' 去听'));
      actions.appendChild(link);
    }

    var lyricsBox = el('pre', 'song-lyrics');
    if (song.lrc) {
      var lyricsBtn = el('button', 'song-lyrics-btn', '歌词');
      lyricsBtn.type = 'button';
      lyricsBtn.addEventListener('click', function () {
        if (lyricsBox.classList.contains('is-open')) {
          lyricsBox.classList.remove('is-open');
          lyricsBtn.textContent = '歌词';
          return;
        }
        if (lyricsBox.dataset.loaded) {
          lyricsBox.classList.add('is-open');
          lyricsBtn.textContent = '收起歌词';
          return;
        }
        lyricsBtn.disabled = true;
        window.fetch(song.lrc)
          .then(function (res) {
            if (!res.ok) throw new Error(res.status);
            return res.text();
          })
          .then(function (text) {
            var lines = lrcToLines(text);
            if (!lines.length && song.lines) lines = song.lines;
            lyricsBox.textContent = lines.join('\n') || '（这首歌没有歌词）';
            lyricsBox.dataset.loaded = '1';
            lyricsBox.classList.add('is-open');
            lyricsBtn.textContent = '收起歌词';
          })
          .catch(function () {
            lyricsBox.textContent = (song.lines || []).join('\n') || '（歌词加载失败）';
            lyricsBox.classList.add('is-open');
            lyricsBtn.textContent = '收起歌词';
          })
          .then(function () { lyricsBtn.disabled = false; });
      });
      actions.appendChild(lyricsBtn);
    }

    card.appendChild(actions);
    card.appendChild(lyricsBox);
    return card;
  }

  window.fetch('/site.json')
    .then(function (res) {
      if (!res.ok) throw new Error(res.status);
      return res.json();
    })
    .then(function (data) {
      var songs = (data.lyrics || []).slice();

      /* 最近添加的排前面；没有 added 的排最后 */
      songs.sort(function (a, b) {
        return String(b.added || '').localeCompare(String(a.added || ''));
      });

      if (!songs.length) {
        root.appendChild(el('p', 'songs-empty', '还没有添加歌曲。'));
        return;
      }

      songs.forEach(function (song) {
        root.appendChild(buildCard(song));
      });
    })
    .catch(function () {
      root.innerHTML = '<p class="songs-empty">歌单加载失败，请刷新重试。</p>';
    });
})();
