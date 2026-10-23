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
const matter = require('gray-matter');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'source/_posts');
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
  widget: path.join(DATA_DIR, 'widget.yml')
};

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

function listPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs.readdirSync(POSTS_DIR)
    .filter(function (name) { return name.endsWith('.md'); })
    .sort(function (a, b) { return a.localeCompare(b, 'zh'); })
    .map(function (name) {
      const file = path.join(POSTS_DIR, name);
      const parsed = matter(readText(file));
      return {
        file: name,
        fm: normalizeFrontMatter(parsed.data),
        body: parsed.content.replace(/^\n+/, '')
      };
    });
}

function postPath(file) {
  /* 只允许 _posts 下的 .md，防目录穿越 */
  const name = path.basename(String(file || ''));
  if (!/\.md$/i.test(name)) throw new Error('只允许 .md 文件');
  const full = path.join(POSTS_DIR, name);
  if (!full.startsWith(POSTS_DIR + path.sep)) throw new Error('非法路径');
  return full;
}

function savePost(file, fm, body) {
  const full = postPath(file);
  writeText(full, stringifyPost(fm || {}, body));
  return { file: path.basename(full) };
}

function slugify(title) {
  return String(title || '未命名')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || '未命名';
}

function createPost(title) {
  let name = slugify(title);
  let full = path.join(POSTS_DIR, name + '.md');
  let i = 2;
  while (fs.existsSync(full)) {
    full = path.join(POSTS_DIR, name + '-' + i + '.md');
    i++;
  }
  const now = new Date();
  const fm = {
    title: String(title || '未命名'),
    date: formatDate(now),
    description: '',
    categories: [],
    tags: [],
    katex: false
  };
  writeText(full, stringifyPost(fm, ''));
  return { file: path.basename(full), fm: fm, body: '' };
}

function deletePost(file) {
  const full = postPath(file);
  if (!fs.existsSync(full)) throw new Error('文件不存在');
  /* 不直接 rm：交给系统回收站，误删可恢复 */
  const { spawnSync } = require('child_process');
  const result = spawnSync('trash', [full], { shell: true, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error('移入回收站失败：' + (result.stderr || result.error || '未知错误'));
  }
  return { file: path.basename(full) };
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

/* ---- 一次性读取全部内容 ------------------------------------------------ */

function readAll() {
  return {
    posts: listPosts(),
    shuoshuo: readYaml(DATA_FILES.shuoshuo, []),
    link: readYaml(DATA_FILES.link, []),
    site: readYaml(DATA_FILES.site, {}),
    about: readAbout()
  };
}

module.exports = {
  ROOT,
  DATA_FILES,
  readAll,
  listPosts,
  savePost,
  createPost,
  deletePost,
  readAbout,
  saveAbout,
  readYaml,
  writeYaml
};
