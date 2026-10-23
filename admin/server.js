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
  /* detached + stdio:ignore：管理页关掉后它也继续跑，且不弹终端窗口 */
  const child = spawn('pnpm', ['exec', 'hexo', 'server'], {
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
      return sendJSON(res, 200, content.createPost(body.title));
    }

    if (pathname.startsWith('/api/posts/') && method === 'PUT') {
      const file = pathname.slice('/api/posts/'.length);
      const body = await readBody(req);
      return sendJSON(res, 200, content.savePost(file, body.fm, body.body));
    }

    if (pathname.startsWith('/api/posts/') && method === 'DELETE') {
      const file = pathname.slice('/api/posts/'.length);
      return sendJSON(res, 200, content.deletePost(file));
    }

    if (method === 'PUT' && /^\/api\/data\/(shuoshuo|link|site)$/.test(pathname)) {
      const key = pathname.split('/').pop();
      const body = await readBody(req);
      content.writeYaml(content.DATA_FILES[key], body.data);
      return sendJSON(res, 200, { ok: true });
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
