/* ============================================================================
 * 更新时间：用 Git 最后一次提交时间
 * ----------------------------------------------------------------------------
 * 为什么不用 mtime：
 *   管理页保存一次、git checkout、复制文件都会改 mtime，
 *   文章页的「更新于」就跟着乱跳，并不代表内容真的改过。
 *
 * 规则（优先级从高到低）：
 *   1. front-matter 里手写的 updated（想手动覆盖时用）
 *   2. git log 里该文件的最后一次提交时间
 *   3. 文章的 date（还没提交过的新文件）
 *
 * 需要搭配：
 *   - _config.yml 的 updated_option: 'empty'（否则 Hexo 会先用 mtime 填上）
 *   - CI 的 actions/checkout 用 fetch-depth: 0（否则拿不到单篇文件的历史）
 *
 * ⚠️ 改完这个文件必须重启 hexo server（scripts 只在进程启动时加载）。
 * ========================================================================= */

'use strict';

const path = require('path');
const { execFileSync } = require('child_process');

let fullHistory = null;

/* 浅克隆（CI 默认可能只取 1 条提交）时，git log 会把「最后一次提交」
   当成每篇文件的修改时间，反而全站错成同一天。检测到浅克隆就回退 date。
   修法：GitHub Actions 用 fetch-depth: 0；Cloudflare 构建命令前加
   `git fetch --unshallow || true &&`。 */
function hasFullHistory() {
  if (fullHistory !== null) return fullHistory;
  try {
    const out = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
      cwd: hexo.base_dir, encoding: 'utf8', timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    fullHistory = out !== 'true';
  } catch (e) {
    fullHistory = false;
  }
  return fullHistory;
}

function gitUpdatedTime(baseDir, source) {
  if (!hasFullHistory()) return null;

  /* source 是相对 source/ 的路径，如 _posts/xxx.md */
  const rel = path.posix.join('source', String(source || '').replace(/\\/g, '/'));
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', rel], {
      cwd: baseDir,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return out ? new Date(out) : null;
  } catch (e) {
    /* 没有 git、或者文件还没提交过：交给调用方回退 */
    return null;
  }
}

hexo.extend.filter.register('before_generate', function () {
  const posts = this.locals.get('posts');

  posts.forEach(function (post) {
    /* front-matter 手写的 updated 优先级最高（empty 模式下只有手写才有值） */
    if (post.updated) return;

    const fromGit = gitUpdatedTime(hexo.base_dir, post.source);
    post.updated = fromGit || post.date;
  });
});

/* 兜底：个别渲染路径拿到的 page 可能不是 before_generate 里改过的那份
   （例如 hexo server 的按需渲染），这里再算一次。 */
hexo.extend.filter.register('before_post_render', function (data) {
  if (data.updated) return data;
  data.updated = gitUpdatedTime(hexo.base_dir, data.source) || data.date;
  return data;
});
