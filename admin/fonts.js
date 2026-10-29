/* ============================================================================
 * 网页字体维护（管理页的「字体」视图）
 * ----------------------------------------------------------------------------
 * 站点的 JetBrains Maple Mono 是「子集化 + unicode-range 分片」的自托管字体：
 *   source/fonts/JetBrainsMapleMono/*.woff2      分片文件（tools/build-fonts.py 生成）
 *   source/css/fonts.css                         @font-face + unicode-range
 *
 * 这里提供两件事：
 *   1. status()  读磁盘上的分片、解析 unicode-range，算出「站点用到的字是否都被覆盖」
 *   2. rebuild() 重跑 tools/build-fonts.py —— 新增文章出现新字（生僻字/新符号）时用
 *
 * 字符扫描范围必须和 tools/build-fonts.py 的 scan_chars() 保持一致，
 * 否则这里报「缺字」、那边实际已经包含了，会互相打架。
 * ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FONT_DIR = path.join(ROOT, 'source', 'fonts', 'JetBrainsMapleMono');
const CSS_FILE = path.join(ROOT, 'source', 'css', 'fonts.css');
const SCRIPT = path.join(ROOT, 'tools', 'build-fonts.py');

/* 与 build-fonts.py 的 exts 对应 */
const TEXT_EXTS = /\.(md|ya?ml|json|html|js|css|lrc|txt)$/i;
/* 二进制/字体目录不参与字符扫描 */
const SKIP_DIRS = ['source/fonts', 'source/images', 'source/img', 'source/css/katex-fonts'];

function walkFiles(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return;
  }
  entries.forEach(function (entry) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (SKIP_DIRS.indexOf(rel) !== -1) return;
      walkFiles(full, out);
      return;
    }
    if (TEXT_EXTS.test(entry.name)) out.push(full);
  });
}

/* 站点点到点会渲染出来的字符 */
function scanSiteChars() {
  const files = [];
  walkFiles(path.join(ROOT, 'source'), files);
  ['_config.yml', '_config.butterfly.yml'].forEach(function (name) {
    const file = path.join(ROOT, name);
    if (fs.existsSync(file)) files.push(file);
  });
  [path.join(ROOT, 'scripts'), path.join(ROOT, 'themes/butterfly/languages')].forEach(function (dir) {
    const list = [];
    walkFiles(dir, list);
    list.forEach(function (file) {
      /* 语言包只要中文那份，其他语言的字符用不上 */
      if (path.basename(file) === 'en.yml' || path.basename(file) === 'zh-CN.yml' || dir.endsWith('scripts')) {
        files.push(file);
      }
    });
  });

  const chars = new Set();
  files.forEach(function (file) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (e) {
      return;
    }
    for (const ch of text) chars.add(ch);
  });
  return chars;
}

function isCjk(ch) {
  const cp = ch.codePointAt(0);
  return (cp >= 0x3400 && cp <= 0x9fff) || (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0x20000 && cp <= 0x2ffff);
}

/* 从 fonts.css 解析所有 @font-face 的 unicode-range，得到「已覆盖码点」合集 */
function parseCoveredRanges(cssText) {
  const covered = new Set();
  const blockRe = /font-weight:\s*([^;]+);[\s\S]*?unicode-range:\s*([^;]+);/g;
  let m;
  while ((m = blockRe.exec(cssText))) {
    m[2].split(',').forEach(function (part) {
      const token = part.trim().replace(/^U\+/i, '');
      if (!token) return;
      const dash = token.indexOf('-');
      if (dash === -1) {
        covered.add(parseInt(token, 16));
        return;
      }
      const from = parseInt(token.slice(0, dash), 16);
      const to = parseInt(token.slice(dash + 1), 16);
      for (let cp = from; cp <= to; cp++) covered.add(cp);
    });
  }
  return covered;
}

function readSlices() {
  let names = [];
  try {
    names = fs.readdirSync(FONT_DIR);
  } catch (e) {
    return [];
  }
  return names
    .filter(function (name) { return /\.woff2$/i.test(name); })
    .sort()
    .map(function (name) {
      const full = path.join(FONT_DIR, name);
      const stat = fs.statSync(full);
      const base = name.replace(/\.woff2$/i, '');
      const dash = base.indexOf('-');
      return {
        file: name,
        weight: dash === -1 ? '' : base.slice(0, dash),
        slice: dash === -1 ? base : base.slice(dash + 1),
        size: stat.size,
        mtime: stat.mtime.toISOString()
      };
    });
}

function status() {
  const slices = readSlices();
  const totalSize = slices.reduce(function (sum, item) { return sum + item.size; }, 0);

  let css = null;
  if (fs.existsSync(CSS_FILE)) {
    const stat = fs.statSync(CSS_FILE);
    css = { size: stat.size, mtime: stat.mtime.toISOString(), faces: 0 };
    css.faces = (fs.readFileSync(CSS_FILE, 'utf8').match(/@font-face/g) || []).length;
  }

  const siteChars = scanSiteChars();
  const covered = css ? parseCoveredRanges(fs.readFileSync(CSS_FILE, 'utf8')) : new Set();
  const missing = [];
  let cjk = 0;
  siteChars.forEach(function (ch) {
    if (isCjk(ch)) cjk++;
    const cp = ch.codePointAt(0);
    /* 控制字符/换行之类不参与判断 */
    if (cp < 0x20 || cp === 0x7f) return;
    if (!covered.has(cp)) missing.push(ch);
  });

  return {
    fontFamily: 'JetBrains Maple Mono',
    script: fs.existsSync(SCRIPT),
    slices: slices,
    totalSize: totalSize,
    css: css,
    chars: {
      total: siteChars.size,
      cjk: cjk,
      missingCount: missing.length,
      /* 只回传前 300 个，够看清是哪类字 */
      missing: missing.slice(0, 300)
    }
  };
}

function rebuild() {
  return new Promise(function (resolve) {
    if (!fs.existsSync(SCRIPT)) {
      resolve({ ok: false, output: '找不到 tools/build-fonts.py' });
      return;
    }
    const started = Date.now();
    execFile('python', ['tools/build-fonts.py'], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 15 * 60 * 1000,
      maxBuffer: 20 * 1024 * 1024,
      env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' })
    }, function (err, stdout, stderr) {
      const output = [stdout || '', stderr || ''].join('\n').trim();
      resolve({
        ok: !err,
        code: err ? (err.code || 1) : 0,
        seconds: Math.round((Date.now() - started) / 1000),
        /* 字体构造时 fontTools 会刷 FFTM 警告，对结果没影响，过滤掉免得误导 */
        output: output.split('\n').filter(function (line) {
          return line.indexOf('FFTM NOT subset') === -1;
        }).join('\n')
      });
    });
  });
}

module.exports = { status: status, rebuild: rebuild };
