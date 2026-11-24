# 数学交互练习题库（源码说明）

工科数学分析（上）+ 线性代数（前三章）交互式练习题库。纯静态页面：无后端、无框架、无 CDN，
双击 `index.html` 即可离线使用。

## 目录

```
quiz-build/                 # 构建工程（不含在作品包内）
├── parse.mjs               # 数分题库 md → 结构化题目
├── parse-linalg.mjs        # 线代练习册 md → 结构化题目 + 技巧卡
├── parse-summary.mjs       # 数分考前速查 md → 技巧卡（含 3 处表述小修）
├── meta.mjs                # 数分 70 题的章节 / 知识点 / 难度 / 判分方式
├── meta-linalg.mjs         # 线代 70 题的同上
├── weights.mjs             # 重要性评级（必考 / 重点 / 常规），按知识点 + 逐题覆盖
├── find-errors.mjs         # 19 道「找错」题（错误步骤 + 错因选项，数分 13 + 线代 6）
├── build.mjs               # 渲染 KaTeX → 输出静态站点（--zip 可选打离线包）
├── index.template.html     # 页面骨架
├── assets/
│   ├── eval-expr.js        # 数值答案判分引擎（支持 3/4、e^-4、100!、\frac{}{}）
│   ├── quiz.css            # Everforest 亮/暗双主题
│   └── quiz.js             # 练习 / 错题本 / 知识点 交互
├── tools/
│   ├── smoke.mjs           # Edge headless + CDP 的 64 项交互冒烟测试
│   └── shots.mjs           # 各视图截图
└── out/                    # 构建产物（= 部署到站点的目录）
```

## 构建

三份数据源（都在 `quiz-build/` 的上一级）：

| 文件 | 内容 |
|---|---|
| `宋浩750题_期中范围_解答.md` | 数分 70 题（`# 宋 NN` + 题目 / 答案 / 易错 / 小结） |
| `线性代数_前三章_70题_练习与答案.md` | 线代 70 题（三部分：题目 / 答案与解析 / 技巧总结） |
| `数分总结.md` | 考前速查（13 段公式表与方法论）→ 技巧卡 |

依赖 `markdown-it` 与 `@renbaoshuo/markdown-it-katex`（复用博客仓库已装的
`node_modules`，通过 `createRequire` 指向 `~/blog/package.json`）。

```bash
cd quiz-build
node parse.mjs                 # 数分：70 题 / 13 道选择题的选项与答案键
node parse-linalg.mjs          # 线代：70 题 / 15 道选择题 / 22 张技巧卡
node parse-summary.mjs         # 数分总结：13 张技巧卡
node build.mjs                 # 输出到 ./out
node build.mjs --out <目录>    # 指定输出目录（部署时指向站点 source/exercise）
node build.mjs --zip           # 顺便打一个 out.zip 离线包（含 index.html 的文件夹）
```

构建时会校验：各套数据的题数与题号集合是否一致、选择题是否抽到答案键、
数值题的 `expect` 能否被 `eval-expr.js` 求值、找错题的 `wrong` / `why` 是否合法。
任一失败即中止。

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

数分（`meta.mjs`，题号来自 md 的 `# 宋 NN`）：

```js
{
  no: '78',                     // 原书题号
  chapter: 'ch1',               // 章节（ch1–ch4）
  topic: '第二重要极限（1^∞）',  // 知识点（知识点页按它聚合）
  level: 2,                     // 难度：1 基础 / 2 进阶 / 3 综合
  check: {                      // 可省略：省略即「自评」题
    fields: [{ label: '', expect: 'e^-4' }],
  },
}
```

线代（`meta-linalg.mjs`，同构，章节为 `lch1`–`lch3`）。重要性不写在题上，
由 `weights.mjs` 按知识点批量给、逐题覆盖：

```js
export const TOPIC_WEIGHT = { '行列式的计算': 3, ... };
export const OVERRIDE = { 'la-20': 1, ... };
```

### 四种题型

| 题型 | 判定方式 |
|---|---|
| `choice` | 题目自带 A–D 选项 + 答案以 `**B**` / `B。` 开头 → 点选项自动判分 |
| `expr` | `meta.check.fields` 有内容 → 输入框逐空判分 |
| `self` | 其余（求导、矩阵求逆、证明类）→ 展开答案后自评「算对了 / 算错了」 |
| `find` | `find-errors.mjs` 的找错题：先点错误步骤，再选错因，最后看正解 |

找错题不再单独成页，而是并入练习流：按章节挂在对应知识点下，同样进题号格
（数分 `F1–F13`、线代 `LF1–LF6`）、进错题本、进统计。

## 技巧卡

- 线代 22 张：练习册第三部分「技巧总结与易错点」（`A/B/C` → 三章，`D` → 通用）
- 数分 13 张：考前速查笔记（等价无穷小、$o(x^n)$ 运算表、泰勒、间断点分类、
  不可导点判据、洛必达化型、最大项定理……，开头散记整理成「解题前的 9 条提醒」）

均显示在「知识点」页对应章节上方，可一键展开 / 收起。

## 学生侧功能

- 先选课程（全部 / 数分 / 线代），再按章节、题型（选择 / 填数值 / 自评 / 找错）、
  重要性（必考 / 重点 / 常规）筛选；也能直接搜题号、知识点或题干文字
- 右侧题号格跳题（线代题 `L` 前缀、找错题 `F` 前缀），网格可滚动并自动定位；
  下面是按章节的进度条
- 选择 / 填数值即时判分；自评题展开解析后自评；找错题两步作答
- 错题本：答错与「算错了」自动收录，可「开始重练」串成一轮，可「导出进度」JSON
- 知识点页：课程 → 章节 → 技巧卡 → 知识点 → 题目链接
- 键盘：`←` `→` 切题，`1`–`4` 选选项，`Enter` 提交
- 亮 / 暗主题切换；进度存 `localStorage`（键 `gksx-quiz-v1`）

## 验收脚本

```bash
# 本地起静态服务（产物目录）
python -m http.server 4180 -d out

# 用 Edge headless + CDP 跑 64 项冒烟测试
"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  --headless=new --disable-gpu --remote-debugging-port=9333 \
  --user-data-dir="$TEMP/edge-cdp-quiz" about:blank &
BASE=http://127.0.0.1:4180/ node tools/smoke.mjs

# 各视图截图（桌面暗/亮 + 找错 + 重练 + 知识点）
node tools/shots.mjs
```

`tools/smoke.mjs` 会先清空 localStorage 再跑，断言失败或页面抛错都会返回非零。
覆盖：筛选与搜索、四种题型判分、多空题、自评、找错两步流程、错题本与重练、
知识点折叠、刷新保留、`file://` 离线。

## 题库规模

**159 题 = 数分 83（70 练习 + 13 找错）+ 线代 76（70 练习 + 6 找错）**，
另有 **35 张技巧卡**，满足 B2 选题「题库 ≥100 题」。

| 课程 | 题量 | 选择 | 填数值 | 自评 | 找错 | 章节 / 知识点 |
|---|---|---|---|---|---|---|
| 工科数学分析（上） | 83 | 13 | 33 | 24 | 13 | 4 章 / 25 个 |
| 线性代数（前三章） | 76 | 15 | 15 | 40 | 6 | 3 章 / 25 个 |
| 合计 | 159 | 28 | 48 | 64 | 19 | 7 章 / 50 个 |

重要性：必考 97 / 重点 56 / 常规 6（随 `weights.mjs` 调整）。

## 部署

产物是纯静态目录。本站的做法：输出到博客仓库的 `source/exercise/`，
并在 Hexo 的 `_config.yml` 里加 `skip_render: 'exercise/**'`，让该目录原样复制，
再 `git push` 即可随博客自动发布（GitHub Pages + Cloudflare Workers）。

期末下线：`git rm -r source/exercise`，删掉 `skip_render` 那一行，push。

## 来源

- 数分部分改编自宋浩主编《高等数学（上册）精选 750 题》（人民邮电出版社，2023）第 1–3 章，题号沿用原书；
- 线代部分取自线性代数第 1–3 章练习册（70 题）；
- 技巧卡整理自考前速查笔记与练习册的技巧总结。

解析与找错题为本作品整理；找错题中的「AI 解答」是教学设计的错误示例。
数学内容以教材与课堂为准。
