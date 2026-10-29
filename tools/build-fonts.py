#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把本机的 JetBrains Maple Mono 子集化成分片 woff2，并生成 @font-face 样式。

为什么要这个脚本
----------------
JetBrains Maple Mono 的 ttf 一个就 18MB（34k 字形），直接塞网页不可能。
这里按「页面实际用到的字符」切成 4 片，用 unicode-range 让浏览器只下需要的片：

  latin        ASCII + 标点/符号 + 站点里出现的西文字符      ~24KB
  han-site     本站所有文章/配置里出现过的汉字               ~313KB
  han-common   GB2312 一级汉字里本站还没用到的               ~645KB
  han-ext      GB2312 二级（生僻字，几乎不会被下载）         ~832KB

常见页面只需 latin + han-site ≈ 340KB。

怎么用
------
    python tools/build-fonts.py

会覆盖 source/fonts/JetBrainsMapleMono/*.woff2 和 source/css/fonts.css。
**新增文章后如果出现了字体里没有的字**（比如生僻字、新符号），重跑一次即可。

依赖：pip install fonttools brotli
字体来源：本机已安装的 C:/Windows/Fonts/JetBrainsMapleMono-{Regular,Bold}.ttf
"""
import glob
import io
import os
import sys

try:
    from fontTools import subset
except ImportError:
    sys.exit('缺少 fontTools：pip install fonttools brotli')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_FONT_DIR = os.path.join(ROOT, 'source', 'fonts', 'JetBrainsMapleMono')
OUT_CSS = os.path.join(ROOT, 'source', 'css', 'fonts.css')

WEIGHTS = {
    '400': 'C:/Windows/Fonts/JetBrainsMapleMono-Regular.ttf',
    '700': 'C:/Windows/Fonts/JetBrainsMapleMono-Bold.ttf',
}

# 连字要留，CJK 排版特性不需要
LAYOUT_FEATURES = ['liga', 'calt', 'kern', 'ccmp', 'locl', 'mark', 'mkmk', 'rlig']

# 站点里常见、但正文纯文本扫描不一定能覆盖到的符号（UI 图标、箭头、框线等）
EXTRA_SYMBOLS = set(
    '©®™°±×÷–—‘’“”…‰′″‹›«»§¶†‡•·'
    '→←↑↓↔⇒⇐⇔≠≤≥≈≡∞√∑∏∫∂∆∇∈∉⊂⊃⊆⊇∪∩∧∨¬∀∃∅'
    '●○◆◇■□▲△▼▽★☆✓✔✗✘⚠'
    '─│┌┐└┘├┤┬┴┼━┃┏┓┗┛┣┫┳┻╋═║╔╗╚╝╠╣╦╩╬'
)
EXTRA_SYMBOLS |= set('　、。〈〉《》「」『』【】〔〕〖〗〝〞﹏！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝～')


def scan_chars():
    """站点点到点能渲染出来的字符：源码 + 配置文件 + 主题语言包 + 歌词文件。"""
    chars = set()
    exts = ('md', 'yml', 'yaml', 'json', 'html', 'js', 'css', 'lrc', 'txt')
    patterns = (
        'source/**/*',
        'scripts/*.js',            # 生成 feed/library 数据时用到中文标签
        'themes/butterfly/languages/zh-CN.yml',
        'themes/butterfly/languages/en.yml',
    )
    for pattern in patterns:
        for path in glob.glob(os.path.join(ROOT, pattern), recursive=True):
            if not os.path.isfile(path):
                continue
            if path.split('.')[-1].lower() not in exts:
                continue
            try:
                chars |= set(io.open(path, encoding='utf-8', errors='ignore').read())
            except OSError:
                pass
    for name in ('_config.yml', '_config.butterfly.yml'):
        path = os.path.join(ROOT, name)
        if os.path.exists(path):
            chars |= set(io.open(path, encoding='utf-8', errors='ignore').read())
    return chars


def gb2312_level(level):
    """GB2312 一级（常用 3755）/ 二级（次常用 3008）汉字。"""
    out = set()
    rng = range(0xB0, 0xD8) if level == 1 else range(0xD8, 0xF8)
    for hi in rng:
        for lo in range(0xA1, 0xFF):
            try:
                out.add(bytes([hi, lo]).decode('gb2312'))
            except UnicodeDecodeError:
                pass
    return out


def is_cjk(ch):
    cp = ord(ch)
    return 0x3400 <= cp <= 0x9FFF or 0xF900 <= cp <= 0xFAFF or 0x20000 <= cp <= 0x2FFFF


def make_slices(site_chars):
    ascii_chars = {chr(c) for c in range(0x20, 0x7F)}
    latin = ascii_chars | EXTRA_SYMBOLS | {c for c in site_chars if not is_cjk(c)}
    han_site = {c for c in site_chars if is_cjk(c)}
    han_1, han_2 = gb2312_level(1), gb2312_level(2)
    return {
        'latin': latin - han_site,
        'han-site': han_site,
        'han-common': han_1 - han_site,
        'han-ext': (han_2 - han_site) - han_1,
    }


def to_ranges(chars):
    """字符集 → 压缩后的 unicode-range 区间列表。"""
    pts = sorted(ord(c) for c in chars)
    ranges, start, prev = [], None, None
    for cp in pts:
        if start is None:
            start = prev = cp
            continue
        if cp == prev + 1:
            prev = cp
            continue
        ranges.append((start, prev))
        start = prev = cp
    if start is not None:
        ranges.append((start, prev))
    out = []
    for a, b in ranges:
        out.append(f'U+{a:04X}' if a == b else f'U+{a:04X}-{b:04X}')
    return ', '.join(out)


def build(src_ttf, out_path, chars):
    opt = subset.Options()
    opt.flavor = 'woff2'
    opt.layout_features = list(LAYOUT_FEATURES)
    opt.name_IDs = ['*']
    opt.notdef_outline = True
    opt.drop_tables += ['FFTM']
    font = subset.load_font(src_ttf, opt)
    sub = subset.Subsetter(options=opt)
    sub.populate(unicodes=[ord(c) for c in chars])
    sub.subset(font)
    subset.save_font(font, out_path, opt)
    return os.path.getsize(out_path)


def main():
    if not os.path.isdir(OUT_FONT_DIR):
        os.makedirs(OUT_FONT_DIR)

    site_chars = scan_chars()
    slices = make_slices(site_chars)
    print('字符集扫描：站点字符 %d 个，其中汉字 %d 个'
          % (len(site_chars), len(slices['han-site'])))

    faces = []
    total = 0
    for weight, src in WEIGHTS.items():
        if not os.path.exists(src):
            sys.exit('找不到字体文件：%s（先安装 JetBrains Maple Mono）' % src)
        for name, chars in slices.items():
            if not chars:
                continue
            out = os.path.join(OUT_FONT_DIR, '%s-%s.woff2' % (weight, name))
            size = build(src, out, chars)
            total += size
            print('  %-4s %-11s %5d 字  →  %6.0f KB' % (weight, name, len(chars), size / 1024))
            faces.append((weight, name, to_ranges(chars)))

    lines = [
        '/* ============================================================================',
        ' * 网页字体：JetBrains Maple Mono（自托管、子集化、按 unicode-range 分片）',
        ' * 本文件由 tools/build-fonts.py 自动生成 —— 不要手改。',
        ' *',
        ' * 分片说明：latin 是 ASCII + 标点符号；han-site 是本站出现过的汉字；',
        ' * han-common / han-ext 是 GB2312 一二级的兜底，只有页面真用到才下载。',
        ' * 新增文章后如果出现字体里没有的字，重跑一次： python tools/build-fonts.py',
        ' * ========================================================================= */',
        '',
    ]
    for weight, name, urange in faces:
        lines += [
            '@font-face {',
            "  font-family: 'JetBrains Maple Mono';",
            '  font-style: normal;',
            '  font-weight: %s;' % weight,
            '  font-display: swap;',
            "  src: url('/fonts/JetBrainsMapleMono/%s-%s.woff2') format('woff2');" % (weight, name),
            '  unicode-range: %s;' % urange,
            '}',
            '',
        ]
    io.open(OUT_CSS, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))

    print('\n共 %d 个 woff2，合计 %.2f MB' % (len(faces), total / 1024 / 1024))
    print('已写入 %s' % os.path.relpath(OUT_CSS, ROOT).replace('\\', '/'))


if __name__ == '__main__':
    main()
