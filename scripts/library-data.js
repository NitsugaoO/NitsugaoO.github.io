/* ============================================================================
 * 生成 /library.json —— 「文章库」页面的数据源
 * ----------------------------------------------------------------------------
 * 为什么不用 hexo-generator-searchdb 的 search.json：
 *   它只有 title / url / content / categories / tags，**没有 date 和
 *   description**，而文章库正好要靠这两样在右侧展示。
 *
 * 放在站点根目录的 scripts/ 下，Hexo 会自动加载（不需要注册到主题里）。
 * 输出示例：
 *   [{
 *     "title": "第一章 第一节 集合、映射与函数",
 *     "url": "/2026/10/14/.../",
 *     "date": "2026-10-14",
 *     "ts": 1760445660000,
 *     "path": ["数学分析"],            // 分类层级，父 → 子
 *     "tags": ["数学分析", "笔记"],
 *     "description": "一句话简介"
 *   }]
 * ========================================================================= */

hexo.extend.generator.register('library_data', function (locals) {
  var posts = locals.posts
    .filter(function (post) {
      return post.published !== false;
    })
    .sort('-date')
    .map(function (post) {
      /* 分类按 front-matter 的顺序返回（父 → 子），
         文章若写了 categories: [数学分析, 第一章]，这里就是 ['数学分析', '第一章'] */
      var categoryPath = post.categories.toArray().map(function (cat) {
        return cat.name;
      });

      return {
        title: post.title,
        url: '/' + post.path,
        date: post.date.format('YYYY-MM-DD'),
        ts: post.date.valueOf(),
        path: categoryPath,
        tags: post.tags.toArray().map(function (tag) {
          return tag.name;
        }),
        description: post.description || ''
      };
    });

  return {
    path: 'library.json',
    data: JSON.stringify(posts)
  };
});
