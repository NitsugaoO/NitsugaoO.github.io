/* ============================================================================
 * 管理页的数据层：读写仓库里的内容文件
 * ----------------------------------------------------------------------------
 * 只负责「文件 ↔ JS 对象」的转换，不认识 HTTP，也不做任何渲染。
 * 所有路径都从仓库根算，且只允许操作下面这份白名单里的文件。
 *
 * 约定：
 *   - 文章    source/_posts/*.md          front-matter + Markdown
 *   - 说说    source/_data/shuoshuo.yml   数组
 *   - 友链    source/_data/link.yml       数组（分组）
 *   - 站点    source/_data/site.yml       对象（announcement）
 *   - 侧栏    source/_data/widget.yml     对象（top/bottom 卡片）
 *   - 关于    source/about/index.md       front-matter + Markdown
 *
 * 写回格式刻意贴近手写习惯：
 *   - front-matter 用固定字段顺序 + flowLevel:1（数组保持 [a, b] 行内）
 *   - YAML 多行字符串自动用 | 块
 *   - 日期统一写成 "YYYY-MM-DD HH:mm:ss"（不带引号的解析结果会被
 *     js-yaml 变成 Date，这里用 UTC 分量还原字面量，保存前后值不变）
 * ========================================================================= */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const matter = require('gray-matter');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'source/_posts');
const DRAFTS_DIR = path.join(ROOT, 'source/_drafts');
const DATA_DIR = path.join(ROOT, 'source/_data');
const ABOUT_FILE = path.join(ROOT, 'source/about/index.md');

/* front-matter 字段顺序（其余字段原样排在后面） */
const FM_ORDER = [
  'title', 'date', 'description',
  'categories', 'tags', 'katex', 'type', 'top', 'cover',
  'top_img', 'course', 'source'
];

const DATA_FILES = {
  shuoshuo: path.join(DATA_DIR, 'shuoshuo.yml'),
  link: path.join(DATA_DIR, 'link.yml'),
  site: path.join(DATA_DIR, 'site.yml'),
  widget: path.join(DATA_DIR, 'widget.yml'),
  lyrics: path.join(DATA_DIR, 'lyrics.yml')
};

const LRC_DIR = path.join(ROOT, 'source/lrc');

/* ---- 基础工具 ---------------------------------------------------------- */

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function writeText(file, text) {
  /* 统一 UTF-8 + LF，避免和仓库里的 CRLF 混在一起 */
  fs.writeFileSync(file, text.replace(/\r\n/g, '\n'), 'utf8');
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/* Date → 原文件的字面量格式。
   js-yaml 把 "2026-10-14 20:41:00" 解析成 UTC 的 20:41，
   所以用 UTC 分量还原，读入/写出值不变。 */
function formatDate(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (!(value instanceof Date)) return String(value);
  return (
    value.getUTCFullYear() + '-' +
    pad(value.getUTCMonth() + 1) + '-' +
    pad(value.getUTCDate()) + ' ' +
    pad(value.getUTCHours()) + ':' +
    pad(value.getUTCMinutes()) + ':' +
    pad(value.getUTCSeconds())
  );
}

/* Date → 本地字面量。
   用于「新建文章」这种场景：date 是本地当前时间，直接取本地分量。
   （从 YAML 读回来的 Date 要用 formatDate 的 UTC 分量，两者别搞混） */
function formatLocal(value) {
  return value.getFullYear() + '-' +
    pad(value.getMonth() + 1) + '-' +
    pad(value.getDate()) + ' ' +
    pad(value.getHours()) + ':' +
    pad(value.getMinutes()) + ':' +
    pad(value.getSeconds());
}

/* 把 front-matter 对象规范成「普通 JSON 值」，方便前端直接编辑 */
function normalizeFrontMatter(data) {
  const out = {};
  Object.keys(data).forEach(function (key) {
    const value = data[key];
    out[key] = value instanceof Date ? formatDate(value) : value;
  });
  return out;
}

function orderedFrontMatter(fm) {
  const out = {};
  FM_ORDER.forEach(function (key) {
    if (fm[key] !== undefined && fm[key] !== null && fm[key] !== '') out[key] = fm[key];
  });
  Object.keys(fm).forEach(function (key) {
    if (FM_ORDER.indexOf(key) !== -1) return;
    if (fm[key] === undefined || fm[key] === null || fm[key] === '') return;
    out[key] = fm[key];
  });
  return out;
}

function stringifyPost(fm, body) {
  const front = yaml.dump(orderedFrontMatter(fm), {
    lineWidth: -1,
    noRefs: true,
    flowLevel: 1        /* 数组保持 [a, b] 行内，和手写的 md 一致 */
  });
  const text = (body || '').replace(/^\n+/, '').replace(/\s+$/, '');
  return '---\n' + front + '---\n' + text + '\n';
}

function readYaml(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  const loaded = yaml.load(readText(file));
  return loaded === undefined || loaded === null ? fallback : loaded;
}

function writeYaml(file, data) {
  /* 数据文件用全 block 风格（flowLevel: -1）:
     说说/友链都是给人看的结构，行内 flow 会难读。 */
  writeText(file, yaml.dump(data, {
    lineWidth: -1,
    noRefs: true,
    flowLevel: -1
  }));
}

/* ---- 文章 -------------------------------------------------------------- */

/* 两个目录：_posts = 已发布，_drafts = 草稿（Hexo 默认不会生成草稿）。
   两边可能有同名文件，所以每条记录都带 status，前端用「status + file」区分。 */

/* Git 里该文件的最后提交时间（管理页只读展示用）。
   规则与站点的 scripts/updated-from-git.js 一致：手写 updated > git > date。
   缓存 key 带上 HEAD 和文件 mtime，轮询时不会反复跑 git。 */
const gitCache = new Map();

let fullHistory = null;

function hasFullHistory() {
  if (fullHistory !== null) return fullHistory;
  try {
    const out = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
      cwd: ROOT, encoding: 'utf8', timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    fullHistory = out !== 'true';
  } catch (e) {
    fullHistory = false;
  }
  return fullHistory;
}

function headCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: ROOT, encoding: 'utf8', timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch (e) {
    return '';
  }
}

function gitUpdated(file, isDraft, fullPath) {
  if (!hasFullHistory()) return null;

  let stat;
  try {
    stat = fs.statSync(fullPath);
  } catch (e) {
    return null;
  }

  const key = fullPath + '|' + stat.mtimeMs + '|' + headCommit();
  if (gitCache.has(key)) return gitCache.get(key);

  const rel = path.posix.join('source', isDraft ? '_drafts' : '_posts', file);
  let value = null;
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', rel], {
      cwd: ROOT, encoding: 'utf8', timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    if (out) value = new Date(out);
  } catch (e) {
    value = null;
  }

  gitCache.set(key, value);
  return value;
}

function readPostDir(dir, status) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(function (name) { return name.endsWith('.md'); })
    .map(function (name) {
      const full = path.join(dir, name);
      const parsed = matter(readText(full));
      const fm = normalizeFrontMatter(parsed.data);

      /* 手写 updated 优先，其次 git 提交时间，最后回退创建时间 */
      const fromGit = gitUpdated(name, status === 'draft', full);
      const updated = fm.updated
        ? fm.updated
        : (fromGit ? formatLocal(fromGit) : (fm.date || ''));

      return {
        file: name,
        status: status,                 /* published | draft */
        updated: updated,
        fm: fm,
        body: parsed.content.replace(/^\n+/, '')
      };
    });
}

function listPosts() {
  return readPostDir(POSTS_DIR, 'published').concat(readPostDir(DRAFTS_DIR, 'draft'));
}

function postDir(isDraft) {
  return isDraft ? DRAFTS_DIR : POSTS_DIR;
}

function postPath(file, isDraft) {
  /* 只允许 posts/drafts 下的 .md，防目录穿越 */
  const name = path.basename(String(file || ''));
  if (!/\.md$/i.test(name)) throw new Error('只允许 .md 文件');
  const dir = postDir(isDraft);
  const full = path.join(dir, name);
  if (!full.startsWith(dir + path.sep)) throw new Error('非法路径');
  return full;
}

function savePost(file, fm, body, isDraft) {
  const full = postPath(file, isDraft);
  writeText(full, stringifyPost(fm || {}, body));
  return { file: path.basename(full), status: isDraft ? 'draft' : 'published' };
}

function slugify(title) {
  return String(title || '未命名')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || '未命名';
}

function uniquePath(dir, base) {
  let full = path.join(dir, base + '.md');
  let i = 2;
  while (fs.existsSync(full)) {
    full = path.join(dir, base + '-' + i + '.md');
    i++;
  }
  return full;
}

function createPost(title, isDraft) {
  const dir = postDir(isDraft);
  fs.mkdirSync(dir, { recursive: true });

  const full = uniquePath(dir, slugify(title));
  const now = new Date();
  const fm = {
    title: String(title || '未命名'),
    date: formatLocal(now),
    description: '',
    categories: [],
    tags: [],
    katex: false
  };
  writeText(full, stringifyPost(fm, ''));
  return {
    file: path.basename(full),
    status: isDraft ? 'draft' : 'published',
    fm: fm,
    body: ''
  };
}

/* 草稿 → 已发布：移动到 _posts（等价于 hexo publish，但不用起 Hexo） */
function publishPost(file) {
  const src = postPath(file, true);
  if (!fs.existsSync(src)) throw new Error('草稿不存在');
  fs.mkdirSync(POSTS_DIR, { recursive: true });
  const dst = uniquePath(POSTS_DIR, path.basename(file, '.md'));
  fs.renameSync(src, dst);
  return { file: path.basename(dst), status: 'published' };
}

function deletePost(file, isDraft) {
  const full = postPath(file, isDraft);
  if (!fs.existsSync(full)) throw new Error('文件不存在');
  /* 不直接 rm：交给系统回收站，误删可恢复 */
  const { spawnSync } = require('child_process');
  const result = spawnSync('trash', [full], { shell: true, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error('移入回收站失败：' + (result.stderr || result.error || '未知错误'));
  }
  return { file: path.basename(full), status: isDraft ? 'draft' : 'published' };
}

/* ---- 歌词（source/lrc/*.lrc） ----------------------------------------- */

function lrcPath(name) {
  const base = path.basename(String(name || ''));
  if (!/\.lrc$/i.test(base)) throw new Error('只允许 .lrc 文件');
  const full = path.join(LRC_DIR, base);
  if (!full.startsWith(LRC_DIR + path.sep)) throw new Error('非法路径');
  return full;
}

function readLrc(name) {
  const full = lrcPath(name);
  return fs.existsSync(full) ? readText(full) : '';
}

function writeLrc(name, text) {
  fs.mkdirSync(LRC_DIR, { recursive: true });
  writeText(lrcPath(name), String(text || ''));
  return { file: path.basename(String(name)) };
}

/* ---- 关于页 ------------------------------------------------------------ */

function readAbout() {
  if (!fs.existsSync(ABOUT_FILE)) return { fm: {}, body: '' };
  const parsed = matter(readText(ABOUT_FILE));
  return { fm: normalizeFrontMatter(parsed.data), body: parsed.content.replace(/^\n+/, '') };
}

function saveAbout(fm, body) {
  writeText(ABOUT_FILE, stringifyPost(fm || {}, body));
  return readAbout();
}

/* ---- 图片管理 ---------------------------------------------------------- */

const IMAGE_EXTS = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;
const TEXT_EXTS = /\.(md|markdown|ya?ml|js|css|json)$/i;

function walkFiles(dir, onFile) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, onFile);
    else if (entry.isFile()) onFile(full);
  });
}

function toSitePath(full) {
  return '/' + path.relative(path.join(ROOT, 'source'), full).split(path.sep).join('/');
}

/* 扫描所有文本文件，记录 /img/ 与 /images/ 路径出现在哪些文件的第几行 */
function collectImageRefs() {
  const refs = {};
  const scanFiles = [];

  walkFiles(path.join(ROOT, 'source'), function (file) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    if (rel.indexOf('source/img/') === 0 || rel.indexOf('source/images/') === 0) return;
    if (TEXT_EXTS.test(file)) scanFiles.push(file);
  });
  ['_config.yml', '_config.butterfly.yml'].forEach(function (name) {
    const file = path.join(ROOT, name);
    if (fs.existsSync(file)) scanFiles.push(file);
  });

  scanFiles.forEach(function (file) {
    const lines = readText(file).split('\n');
    lines.forEach(function (line, index) {
      const regex = /\/(?:img|images)\/[^\s"'()\[\]<>]+/g;
      let matched;
      while ((matched = regex.exec(line))) {
        const sitePath = matched[0].replace(/[),.;]+$/, '').split('?')[0];
        if (!refs[sitePath]) refs[sitePath] = [];
        refs[sitePath].push({
          file: path.relative(ROOT, file).split(path.sep).join('/'),
          line: index + 1
        });
      }
    });
  });

  return refs;
}

function listImages() {
  const refs = collectImageRefs();
  const images = [];

  ['source/img', 'source/images'].forEach(function (relRoot) {
    walkFiles(path.join(ROOT, relRoot), function (file) {
      if (!IMAGE_EXTS.test(file)) return;
      const sitePath = toSitePath(file);
      const stat = fs.statSync(file);
      images.push({
        path: sitePath,
        size: stat.size,
        mtime: stat.mtime.toISOString(),
        refs: refs[sitePath] || []
      });
    });
  });

  images.sort(function (a, b) { return b.mtime.localeCompare(a.mtime); });
  return images;
}

function ensureInside(baseDir, full) {
  const normalized = path.normalize(full);
  if (normalized !== baseDir && normalized.indexOf(baseDir + path.sep) !== 0) {
    throw new Error('非法路径');
  }
  return normalized;
}

function saveImage(data, mime, dir) {
  const buf = Buffer.from(String(data || ''), 'base64');
  if (!buf.length) throw new Error('图片为空');
  if (buf.length > 15 * 1024 * 1024) throw new Error('图片超过 15MB');

  const type = String(mime || '').toLowerCase();
  if (!/^image\//.test(type)) throw new Error('不是图片');

  const subtype = type.split('/')[1].split(';')[0];
  const ext = subtype === 'jpeg' ? 'jpg' : subtype.replace('svg+xml', 'svg');

  const targetRel = String(dir || 'images').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!/^(images|img)(\/|$)/.test(targetRel)) {
    throw new Error('只能上传到 source/images 或 source/img');
  }

  const sourceRoot = path.join(ROOT, 'source');
  const targetDir = ensureInside(sourceRoot, path.join(sourceRoot, targetRel));
  fs.mkdirSync(targetDir, { recursive: true });

  const hash = require('crypto').createHash('md5').update(buf).digest('hex').slice(0, 10);
  const name = hash + '.' + ext;
  const full = path.join(targetDir, name);
  if (!fs.existsSync(full)) fs.writeFileSync(full, buf);

  return { path: '/' + targetRel + '/' + name, size: buf.length };
}

function deleteImage(sitePath) {
  const rel = String(sitePath || '').replace(/^\/+/, '');
  if (!/^(images|img)\//.test(rel)) throw new Error('只能删除图片');

  const sourceRoot = path.join(ROOT, 'source');
  const full = ensureInside(sourceRoot, path.join(sourceRoot, rel));
  if (!fs.existsSync(full)) throw new Error('图片不存在');

  const { spawnSync } = require('child_process');
  const result = spawnSync('trash', [full], { shell: true, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error('移入回收站失败：' + (result.stderr || result.error || '未知错误'));
  }
  return { path: sitePath };
}

/* ---- 一次性读取全部内容 ------------------------------------------------ */

/* 说说：在数据里附上每条在 YAML 里的行号，管理页的「VSCode」按钮
   才能用 code -g file:line 定位到对应条目。 */
function readShuoshuo() {
  const items = readYaml(DATA_FILES.shuoshuo, []);
  if (!Array.isArray(items)) return [];
  const text = readText(DATA_FILES.shuoshuo);
  const lines = [];
  text.split("\n").forEach(function (line, i) {
    if (/^- date:/.test(line)) lines.push(i + 1);
  });
  return items.map(function (item, i) {
    return Object.assign({}, item, { line: lines[i] || 1 });
  });
}

/* 歌单里的 added 可能被 YAML 解析成 Date，统一成 YYYY-MM-DD */
function normalizeLyrics(items) {
  if (!Array.isArray(items)) return [];
  return items.map(function (song) {
    var out = Object.assign({}, song);
    if (out.added instanceof Date) out.added = formatDate(out.added).slice(0, 10);
    else if (out.added) out.added = String(out.added).slice(0, 10);
    return out;
  });
}

function readAll() {
  return {
    posts: listPosts(),
    shuoshuo: readShuoshuo(),
    link: readYaml(DATA_FILES.link, []),
    site: readYaml(DATA_FILES.site, {}),
    lyrics: normalizeLyrics(readYaml(DATA_FILES.lyrics, [])),
    about: readAbout()
  };
}

module.exports = {
  ROOT,
  DATA_FILES,
  readAll,
  listPosts,
  savePost,
  postPath,
  createPost,
  publishPost,
  deletePost,
  readAbout,
  saveAbout,
  readYaml,
  writeYaml,
  readLrc,
  writeLrc,
  listImages,
  saveImage,
  deleteImage
};
