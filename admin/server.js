/* ============================================================================
 * 本地管理页服务
 * ----------------------------------------------------------------------------
 * 启动：pnpm admin        （只在 127.0.0.1:5173 监听，外部访问不到）
 *
 * 它做三件事：
 *   1. 提供 admin/public/ 下的管理界面
 *   2. 通过 /api/* 读写仓库里的内容文件（content.js）
 *   3. 调 hexo / git 完成「重新生成」和「发布」
 *
 * 没有任何鉴权：不要把它暴露到公网，也不要改成 0.0.0.0。
 * ========================================================================= */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, execFile } = require('child_process');
const content = require('./content');

const HOST = '127.0.0.1';
const PORT = Number(process.env.ADMIN_PORT || 5173);
const ROOT = content.ROOT;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CSS_DIR = path.join(ROOT, 'source/css');

/* ---- 小工具 ------------------------------------------------------------ */

function sendJSON(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendText(res, code, text, type) {
  res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(text);
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let raw = '';
    req.on('data', function (chunk) {
      raw += chunk;
      if (raw.length > 5 * 1024 * 1024) {
        reject(new Error('请求体太大'));
        req.destroy();
      }
    });
    req.on('end', function () {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('JSON 解析失败'));
      }
    });
    req.on('error', reject);
  });
}

function execGit(args) {
  return new Promise(function (resolve) {
    execFile('git', args, { cwd: ROOT, encoding: 'utf8' }, function (err, stdout, stderr) {
      resolve({
        code: err ? (err.code || 1) : 0,
        stdout: (stdout || '').trim(),
        stderr: (stderr || '').trim()
      });
    });
  });
}

function runShell(command) {
  return new Promise(function (resolve) {
    exec(command, { cwd: ROOT, encoding: 'utf8', timeout: 120000 }, function (err, stdout, stderr) {
      resolve({
        code: err ? (err.code || 1) : 0,
        stdout: (stdout || '').trim(),
        stderr: (stderr || '').trim()
      });
    });
  });
}

/* ---- Git 状态：告诉前端「已保存但未发布」有多少改动 -------------------- */

function gitStatus() {
  return new Promise(function (resolve) {
    execFile('git', ['-c', 'core.quotepath=false', 'status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }, function (err, stdout) {
      /* 只去掉末尾空白：整体 trim() 会把第一行开头的状态位（空格）也吃掉，
         导致第一个文件名少一个字母。 */
      const lines = (stdout || '').replace(/\s+$/, '').split(String.fromCharCode(10)).filter(Boolean);
      const files = lines.map(function (line) {
        let name = line.slice(3).trim();
        if (name.charAt(0) === '"' && name.charAt(name.length - 1) === '"') {
          name = name.slice(1, -1);
        }
        return name;
      });

      execFile('git', ['rev-list', '--count', 'origin/master..HEAD'], { cwd: ROOT, encoding: 'utf8' }, function (err2, out2) {
        const ahead = Number((out2 || '0').trim()) || 0;
        resolve({
          dirty: files.length > 0,
          fileCount: files.length,
          files: files.slice(0, 80),
          ahead: ahead,
          unpublished: files.length > 0 || ahead > 0
        });
      });
    });
  });
}

/* ---- 图片：把外部 URL 下载到 source/img/ -------------------------------- */

const IMG_DIR = path.join(ROOT, 'source/img');

function isPrivateHost(hostname) {
  return /^(localhost|127\.|0\.0\.0\.0|\[::1\]|::1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(hostname || '') ||
    /\.local$/i.test(hostname || '');
}

async function downloadImage(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    throw new Error('不是合法的 URL');
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('只支持 http / https');
  if (isPrivateHost(parsed.hostname)) throw new Error('不支持下内网地址');

  const res = await fetch(parsed, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error('下载失败 HTTP ' + res.status);

  const type = String(res.headers.get('content-type') || '');
  if (!/^image\//.test(type)) throw new Error('不是图片（' + (type || '未知类型') + '）');

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 15 * 1024 * 1024) throw new Error('图片超过 15MB');

  const subtype = type.split('/')[1].split(';')[0].trim().toLowerCase();
  const ext = subtype === 'jpeg' ? 'jpg' : (subtype === 'svg+xml' ? 'svg' : subtype);
  const hash = require('crypto').createHash('md5').update(buf).digest('hex').slice(0, 10);
  const name = hash + '.' + ext;

  fs.mkdirSync(IMG_DIR, { recursive: true });
  const file = path.join(IMG_DIR, name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, buf);

  return { path: '/img/' + name, size: buf.length };
}

/* ---- 网易云：搜索 + 歌词（管理页「歌曲」用） ---------------------------- */

const NETEASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  Referer: 'https://music.163.com/'
};

async function neteaseJSON(url) {
  const res = await fetch(url, {
    headers: NETEASE_HEADERS,
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) throw new Error('网易云返回 HTTP ' + res.status);
  return res.json();
}

/* 输入可以是关键词，也可以是分享链接 / 纯数字 id */
function extractNeteaseId(input) {
  const str = String(input || '');
  const matched = str.match(/(?:[?&]id=|song\/)(\d+)/) || str.match(/^(\d+)$/);
  return matched ? matched[1] : null;
}

function mapNeteaseSong(song) {
  return {
    id: String(song.id),
    title: song.name,
    artist: (song.artists || []).map(function (a) { return a.name; }).join(' / '),
    album: (song.album && song.album.name) || '',
    duration: Math.round((song.duration || 0) / 1000)
  };
}

async function neteaseSearch(query) {
  const id = extractNeteaseId(query);
  if (id) {
    const data = await neteaseJSON('https://music.163.com/api/song/detail?ids=[' + id + ']');
    return (data.songs || []).map(mapNeteaseSong);
  }

  const data = await neteaseJSON(
    'https://music.163.com/api/search/get/web?csrf_token=&s=' +
    encodeURIComponent(query) + '&type=1&offset=0&total=true&limit=8'
  );
  return ((data.result && data.result.songs) || []).map(mapNeteaseSong);
}

async function neteaseLyric(id) {
  const data = await neteaseJSON(
    'https://music.163.com/api/song/lyric?os=pc&id=' + encodeURIComponent(id) + '&lv=-1&kv=-1&tv=-1'
  );
  return {
    lyric: (data.lrc && data.lrc.lyric) || '',
    tlyric: (data.tlyric && data.tlyric.lyric) || ''
  };
}

/* ---- 站点预览服务器（hexo server:4000） ---------------------------------- */

const SITE_URL = 'http://localhost:4000/';

function siteRunning() {
  return new Promise(function (resolve) {
    const req = http.get(SITE_URL, function (res) {
      res.resume();
      resolve(true);
    });
    req.on('error', function () { resolve(false); });
    req.setTimeout(1200, function () {
      req.destroy();
      resolve(false);
    });
  });
}

function startSite() {
  const { spawn } = require('child_process');
  /* --draft：本地预览也把 _drafts 渲染出来，草稿才能点开看效果。
     CI 构建不带动参数，线上不会出现草稿。 */
  const child = spawn('pnpm', ['exec', 'hexo', 'server', '--draft'], {
    cwd: ROOT,
    shell: true,
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();
}

async function waitSite(timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await siteRunning()) return true;
    await new Promise(function (resolve) { setTimeout(resolve, 600); });
  }
  return false;
}

/* ---- Markdown 预览 ------------------------------------------------------ */

let md = null;
function getMarkdown() {
  if (md) return md;
  const MarkdownIt = require('markdown-it');
  md = new MarkdownIt({ html: true, breaks: true, linkify: true });
  try {
    const katexPlugin = require('@renbaoshuo/markdown-it-katex');
    md.use(katexPlugin, { strict: false, skipDelimitersCheck: true });
  } catch (e) {
    /* 公式插件不可用时，预览里保留原始 TeX 文本 */
  }
  return md;
}

/* ---- 静态文件 ---------------------------------------------------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2'
};

function serveFile(res, file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    sendText(res, 404, 'Not Found');
    return;
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  fs.createReadStream(file).pipe(res);
}

/* ---- 路由 -------------------------------------------------------------- */

const server = http.createServer(async function (req, res) {
  const url = new URL(req.url, 'http://' + HOST + ':' + PORT);
  const pathname = decodeURIComponent(url.pathname);
  const method = req.method;

  try {
    /* ---- 静态 ---- */
    if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      return serveFile(res, path.join(PUBLIC_DIR, 'index.html'));
    }
    if (method === 'GET' && (pathname === '/app.js' || pathname === '/style.css')) {
      return serveFile(res, path.join(PUBLIC_DIR, pathname.slice(1)));
    }

    /* 预览用的 KaTeX 样式：直接复用 source/css 里的本地文件 */
    if (method === 'GET' && pathname === '/preview/katex.min.css') {
      return serveFile(res, path.join(CSS_DIR, 'katex.min.css'));
    }
    if (method === 'GET' && pathname.startsWith('/preview/katex-fonts/')) {
      const name = path.basename(pathname);
      return serveFile(res, path.join(CSS_DIR, 'katex-fonts', name));
    }

    /* 预览里的图片：Markdown 写的是 /images/...、/img/...，
       管理页在 5173 上，必须自己映射到 source 目录，否则预览一片空白。 */
    if (method === 'GET' && (pathname.startsWith('/images/') || pathname.startsWith('/img/'))) {
      const base = pathname.startsWith('/images/') ? 'source/images' : 'source/img';
      const rel = pathname.replace(/^\/(images|img)\//, '');
      const target = path.normalize(path.join(ROOT, base, rel));
      /* 防目录穿越：必须还在 source/images 或 source/img 里 */
      const root = path.join(ROOT, base);
      if (!target.startsWith(root + path.sep)) {
        return sendText(res, 403, 'Forbidden');
      }
      return serveFile(res, target);
    }

    /* ---- API ---- */
    if (pathname === '/api/state' && method === 'GET') {
      return sendJSON(res, 200, content.readAll());
    }

    /* 图片管理：列表 + 上传 + 删除 */
    if (pathname === '/api/images' && method === 'GET') {
      return sendJSON(res, 200, { images: content.listImages() });
    }

    if (pathname === '/api/upload-image' && method === 'POST') {
      const body = await readBody(req);
      return sendJSON(res, 200, content.saveImage(body.data, body.mime, body.dir));
    }

    if (pathname === '/api/delete-image' && method === 'POST') {
      const body = await readBody(req);
      return sendJSON(res, 200, content.deleteImage(body.path));
    }

    /* 下载外部图片到 source/img/ */
    if (pathname === '/api/download-image' && method === 'POST') {
      const body = await readBody(req);
      const url = String(body.url || '').trim();
      if (!url) return sendJSON(res, 400, { error: '缺少 url' });
      return sendJSON(res, 200, await downloadImage(url));
    }

    if (pathname === '/api/git-status' && method === 'GET') {
      return sendJSON(res, 200, await gitStatus());
    }

    if (pathname === '/api/site-status' && method === 'GET') {
      return sendJSON(res, 200, { running: await siteRunning(), url: SITE_URL });
    }

    if (pathname === '/api/site-start' && method === 'POST') {
      if (await siteRunning()) {
        return sendJSON(res, 200, { ok: true, url: SITE_URL, started: false });
      }
      startSite();
      const ok = await waitSite(30000);
      return sendJSON(res, ok ? 200 : 500, {
        ok: ok,
        url: SITE_URL,
        started: true,
        error: ok ? '' : 'hexo server 启动超时，看终端输出'
      });
    }

    if (pathname === '/api/preview' && method === 'POST') {
      const body = await readBody(req);
      return sendJSON(res, 200, { html: getMarkdown().render(String(body.text || '')) });
    }

    if (pathname === '/api/posts' && method === 'POST') {
      const body = await readBody(req);
      return sendJSON(res, 200, content.createPost(body.title, !!body.draft));
    }

    /* 草稿 → 已发布（移动到 _posts） */
    if (/^\/api\/posts\/[^/]+\/publish$/.test(pathname) && method === 'POST') {
      const file = pathname.slice('/api/posts/'.length, -'/publish'.length);
      return sendJSON(res, 200, content.publishPost(file));
    }

    if (pathname.startsWith('/api/posts/') && method === 'PUT') {
      const file = pathname.slice('/api/posts/'.length);
      const body = await readBody(req);
      const isDraft = url.searchParams.get('draft') === '1';
      return sendJSON(res, 200, content.savePost(file, body.fm, body.body, isDraft));
    }

    if (pathname.startsWith('/api/posts/') && method === 'DELETE') {
      const file = pathname.slice('/api/posts/'.length);
      const isDraft = url.searchParams.get('draft') === '1';
      return sendJSON(res, 200, content.deletePost(file, isDraft));
    }

    /* 用 VSCode 打开（-g 定位到文件首行） */
    if (pathname === '/api/open-vscode' && method === 'POST') {
      const body = await readBody(req);
      let file;

      if (body.type === 'data') {
        /* 允许打开的 _data 文件（白名单） */
        const allowed = {
          shuoshuo: path.join(ROOT, 'source/_data/shuoshuo.yml'),
          site: path.join(ROOT, 'source/_data/site.yml'),
          link: path.join(ROOT, 'source/_data/link.yml')
        };
        file = allowed[body.key];
        if (!file) throw new Error('不允许打开这个文件');
      } else {
        const isDraft = !!body.draft;
        file = content.postPath(body.file, isDraft);
      }

      if (!fs.existsSync(file)) throw new Error('文件不存在');
      const target = body.line ? file + ':' + body.line : file;
      const { spawn } = require('child_process');
      const child = spawn('code', ['-g', target], {
        shell: true,
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      child.unref();
      return sendJSON(res, 200, { ok: true, path: file });
    }

    /* 网易云搜索（关键词 / 分享链接 / id） */
    if (pathname === '/api/netease/search' && method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim();
      if (!q) return sendJSON(res, 400, { error: '缺少关键词' });
      return sendJSON(res, 200, { results: await neteaseSearch(q) });
    }

    /* 网易云歌词 */
    if (pathname === '/api/netease/lyric' && method === 'GET') {
      const id = (url.searchParams.get('id') || '').trim();
      if (!/^\d+$/.test(id)) return sendJSON(res, 400, { error: 'id 不合法' });
      return sendJSON(res, 200, await neteaseLyric(id));
    }

    /* 用系统默认图片查看器打开站内图片 */
    if (pathname === '/api/open-image' && method === 'POST') {
      const body = await readBody(req);
      const src = String(body.src || '');
      const matched = src.match(/^\/(images|img)\//);
      if (!matched) throw new Error('只支持站内图片');

      const base = matched[1];
      const root = path.join(ROOT, 'source', base);
      const rel = src.slice(matched[0].length);
      const file = path.normalize(path.join(root, rel));
      if (!file.startsWith(root + path.sep)) throw new Error('非法路径');
      if (!fs.existsSync(file)) throw new Error('图片不存在');

      const { spawn } = require('child_process');
      const child = spawn('cmd', ['/c', 'start', '', file], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      child.unref();
      return sendJSON(res, 200, { ok: true, path: file });
    }

    if (method === 'PUT' && /^\/api\/data\/(shuoshuo|link|site|lyrics)$/.test(pathname)) {
      const key = pathname.split('/').pop();
      const body = await readBody(req);
      content.writeYaml(content.DATA_FILES[key], body.data);
      return sendJSON(res, 200, { ok: true });
    }

    /* 歌词文件（source/lrc/*.lrc） */
    if (pathname.startsWith('/api/lrc/') && method === 'GET') {
      const file = pathname.slice('/api/lrc/'.length);
      return sendJSON(res, 200, { text: content.readLrc(file) });
    }

    if (pathname.startsWith('/api/lrc/') && method === 'PUT') {
      const body = await readBody(req);
      return sendJSON(res, 200, content.writeLrc(pathname.slice('/api/lrc/'.length), body.text));
    }

    if (pathname === '/api/about' && method === 'PUT') {
      const body = await readBody(req);
      return sendJSON(res, 200, content.saveAbout(body.fm, body.body));
    }

    if (pathname === '/api/generate' && method === 'POST') {
      const result = await runShell('pnpm exec hexo generate');
      const ok = result.code === 0;
      return sendJSON(res, ok ? 200 : 500, {
        ok: ok,
        output: (result.stdout || '') + (result.stderr ? '\n' + result.stderr : '')
      });
    }

    if (pathname === '/api/publish' && method === 'POST') {
      const body = await readBody(req);
      const message = String(body.message || '').trim() || '更新博客内容';

      const add = await execGit(['add', '-A']);
      if (add.code !== 0) return sendJSON(res, 500, { ok: false, step: 'add', output: add.stderr });

      /* 没有改动就别 commit（git commit 会报错） */
      const diff = await execGit(['diff', '--cached', '--quiet']);
      if (diff.code === 0) {
        return sendJSON(res, 200, { ok: true, output: '没有需要提交的改动。' });
      }

      const commit = await execGit(['commit', '-m', message]);
      if (commit.code !== 0) return sendJSON(res, 500, { ok: false, step: 'commit', output: commit.stderr });

      const push = await execGit(['push']);
      if (push.code !== 0) return sendJSON(res, 500, { ok: false, step: 'push', output: push.stderr });

      return sendJSON(res, 200, {
        ok: true,
        output: [commit.stdout, push.stderr || push.stdout].filter(Boolean).join('\n')
      });
    }

    return sendJSON(res, 404, { error: 'Not Found' });
  } catch (err) {
    console.error(err);
    return sendJSON(res, 500, { error: err.message || String(err) });
  }
});

server.listen(PORT, HOST, function () {
  console.log('');
  console.log('  管理页已启动：http://' + HOST + ':' + PORT);
  console.log('  只监听本机，按 Ctrl+C 停止');
  console.log('');
});
