# 数学交互练习题库（源码说明）

工科数学分析（上）+ 线性代数（前三章）交互式练习题库。纯静态页面：无后端、无框架、无 CDN，
双击 `index.html` 即可离线使用。

## 目录

```
quiz-build/                 # 构建工程（不含在作品包内）
├── parse.mjs               # 数分题库 md → 结构化题目
├── parse-linalg.mjs        # 线代练习册 md → 结构化题目 + 技巧卡
├── meta.mjs                # 数分 70 题的章节 / 知识点 / 难度 / 判分方式
├── meta-linalg.mjs         # 线代 70 题的同上
├── find-errors.mjs         # 13 道「找错」题（错误步骤 + 错因选项）
├── build.mjs               # 渲染 KaTeX → 输出静态站点
├── index.template.html     # 页面骨架
├── assets/
│   ├── eval-expr.js        # 数值答案判分引擎（支持 3/4、e^-4、100!、\frac{}{}）
│   ├── quiz.css            # Everforest 亮/暗双主题
│   └── quiz.js             # 练习 / 找错 / 错题本 / 知识点 交互
├── tools/
│   ├── smoke.mjs           # Edge headless + CDP 的 45 项交互冒烟测试
│   └── shots.mjs           # 各视图截图
└── out/                    # 构建产物（= 部署到站点的目录）
```

## 构建

两份数据源（都在 `quiz-build/` 的上一级）：

| 文件 | 内容 |
|---|---|
| `宋浩750题_期中范围_解答.md` | 数分 70 题（`# 宋 NN` + 题目 / 答案 / 易错 / 小结） |
| `线性代数_前三章_70题_练习与答案.md` | 线代 70 题（三部分：题目 / 答案与解析 / 技巧总结） |

依赖 `markdown-it` 与 `@renbaoshuo/markdown-it-katex`（复用博客仓库已装的
`node_modules`，通过 `createRequire` 指向 `~/blog/package.json`）。

```bash
cd quiz-build
node parse.mjs                 # 数分：70 题 / 13 道选择题的选项与答案键
node parse-linalg.mjs          # 线代：70 题 / 15 道选择题 / 22 张技巧卡
node build.mjs                 # 输出到 ./out
node build.mjs --out <目录>    # 指定输出目录（部署时指向站点 source/exercise）
```

构建时会校验：两套数据的题数与题号集合是否一致、选择题是否抽到答案键、
数值题的 `expect` 能否被 `eval-expr.js` 求值。任一失败即中止。

### 产物

```
out/
├── index.html
├── README.md
└── assets/
    ├── data.js            # 预渲染好的题目 HTML（KaTeX 已在构建期渲染）
    ├── quiz.css / quiz.js / eval-expr.js
    ├── katex.min.css
    └── katex-fonts/*.woff2
```

公式在构建期用 KaTeX 渲染成静态 HTML，运行时不需要公式引擎，
也不加载任何外部资源 → 离线、无网络抖动、首屏快。

## 题目数据格式

`meta.mjs` 的每一项对应 md 里的一题：

数分（`meta.mjs`，题号来自 md 的 `# 宋 NN`）：

```js
{
  no: '78',                     // 原书题号
  chapter: 'ch1',               // 章节（ch1–ch4）
  topic: '第二重要极限（1^∞）',  // 知识点（知识点页按它聚合）
  level: 2,                     // 1 基础 / 2 进阶 / 3 综合
  check: {                      // 可省略：省略即「自评」题
    fields: [{ label: '', expect: 'e^-4' }],
  },
}
```

线代（`meta-linalg.mjs`，同构，章节为 `lch1`–`lch3`）：

```js
{ no: '30', chapter: 'lch2', topic: '方阵的行列式', level: 2,
  check: { fields: [
    { label: '|2A|', expect: '16' },
    { label: '|A²|', expect: '4' },
  ] } }
```

题型由数据决定：

| 题型 | 判定方式 |
|---|---|
| `choice` | 题目自带 A–D 选项 + 答案以 `**B**` / `B。` 开头 → 点选项自动判分 |
| `expr` | `meta.check.fields` 有内容 → 输入框逐空判分 |
| `self` | 其余（求导、矩阵求逆、证明类）→ 展开答案后自评「算对了 / 算错了」 |

线代练习册第三部分是「技巧总结与易错点」，解析器把它切成 22 张技巧卡，
按章显示在「知识点」页（`A/B/C` 三段对应行列式 / 矩阵 / 向量，`D` 段为三章通用）。

`find-errors.mjs` 的每一项是一道找错题：`steps` 是 AI 的分步解答，
`wrong` 是错误步骤下标，`whyOptions` 是错因选项，`why` 是正确项，`explain` 是正解。

## 学生侧功能

- 先选课程（全部 / 数分 / 线代），再按章节 / 题型筛选；右侧题号格跳题（线代题显示 `L` 前缀，网格可滚动并自动定位当前题），颜色标记作答状态
- 选择 / 填数值即时判分；自评题展开解析后自评
- 找错题：点错误步骤（点错会排除该步）→ 再选错因 → 展示正解
- 错题本（答错 + 自评为「算错了」自动收录）、正确率、重置进度
- 知识点页：按课程 / 章节 / 知识点归集，线代每章附技巧卡（速查表、易错点）
- 键盘：`←` `→` 切题，`1`–`4` 选选项，`Enter` 提交
- 亮 / 暗主题切换；进度存 `localStorage`（键 `gksx-quiz-v1`）

## 部署

产物是纯静态目录。本站的做法：输出到博客仓库的 `source/exercise/`，
并在 Hexo 的 `_config.yml` 里加 `skip_render: 'exercise/**'`，让该目录原样复制，
再 `git push` 即可随博客自动发布（GitHub Pages + Cloudflare Workers）。

期末下线：`git rm -r source/exercise`，删掉 `skip_render` 那一行，push。

## 验收脚本

```bash
# 本地起静态服务（产物目录）
python -m http.server 4180 -d out

# 用 Edge headless + CDP 跑 45 项冒烟测试（判分 / 多空 / 课程切换 / 错题本 / 找错 / 知识点 / 刷新保留 / file:// 离线）
"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"   --headless=new --disable-gpu --remote-debugging-port=9333   --user-data-dir="$TEMP/edge-cdp-quiz" about:blank &
BASE=http://127.0.0.1:4180/ node tools/smoke.mjs

# 各视图截图（桌面暗/亮 + 移动端）
node tools/shots.mjs
```

`tools/smoke.mjs` 会先清空 localStorage 再跑，断言失败或页面抛错都会返回非零。

## 题库规模

**140 道练习（数分 70 + 线代 70）+ 13 道找错 + 22 张技巧卡**，满足 B2 选题「题库 ≥100 题」。

| 课程 | 题量 | 选择 | 填数值 | 自评 | 章节 / 知识点 |
|---|---|---|---|---|---|
| 工科数学分析（上） | 70 | 13 | 33 | 24 | 4 章 / 26 个 |
| 线性代数（前三章） | 70 | 15 | 15 | 40 | 3 章 / 19 个 |

## 来源

- 数分部分改编自宋浩主编《高等数学（上册）精选 750 题》（人民邮电出版社，2023）第 1–3 章，题号沿用原书；
- 线代部分取自线性代数第 1–3 章练习册（70 题）。

解析与技巧卡为本作品整理；找错题中的「AI 解答」是教学设计的错误示例。
数学内容以教材与课堂为准。
