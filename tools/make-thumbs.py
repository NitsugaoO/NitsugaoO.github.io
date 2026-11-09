#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""为 source/images 下的原图生成「列表用」的 webp 缩略图。

为什么要这个脚本
----------------
文章 / 说说的正文用的是原图（手机原图 3072×4096、最大 6144×8192 / 17 MB）。
列表页（首页时间流、说说页）把它们塞进 100~300px 的格子里，浏览器却要
下载全尺寸、按原分辨率解码 —— 一条 9 张图的说说 = 61 MB / 约 5 亿像素，
滚动必卡。`loading="lazy"` 只推迟下载，不减解码开销。

这里给每张原图生成一张长边 800 的 webp（30~100 KB），列表用它，灯箱点开
仍然加载原图。原图一个字节都不改。

产物
----
    source/images/thumbs/<相对路径>.webp   例：thumbs/tsctf2026/image-1.png → thumbs/tsctf2026/image-1.webp

小图不生成
----------
源文件 ≤ 100 KB 且长边 ≤ 1000 的（截图、示意图）直接用原图 —— 站点脚本
scripts/lib/img-thumb.js 找不到缩略图时会自动回退原图，所以缺文件不会坏。

怎么用
------
    python tools/make-thumbs.py              # 增量（只补新图 / 改过的图）
    python tools/make-thumbs.py --force      # 全部重建
    python tools/make-thumbs.py --only images/90eae6dc0a.jpg
    python tools/make-thumbs.py --max 1200 --quality 86

增量清单存在 tools/.thumb-manifest.json（source/ 下的东西会被 Hexo 原样
复制到 public，所以清单不能放那里）。

依赖：pip install pillow
"""
import argparse
import json
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit('缺少 Pillow：pip install pillow')

# Windows 控制台默认 GBK，勾号/箭头会乱码
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, 'source', 'images')
THUMB_DIR = os.path.join(IMG_DIR, 'thumbs')
MANIFEST = os.path.join(ROOT, 'tools', '.thumb-manifest.json')

EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif'}
# 小于这个尺寸的图没必要做缩略图（原图本身就够小）
SKIP_BYTES = 100 * 1024
SKIP_SIDE = 1000


def load_manifest():
    try:
        with open(MANIFEST, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_manifest(data):
    with open(MANIFEST, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1, sort_keys=True)


def iter_sources():
    """source/images 下所有图片（跳过 thumbs/ 与 _ 开头的文件/目录）。"""
    for dirpath, dirnames, filenames in os.walk(IMG_DIR):
        dirnames[:] = [d for d in dirnames if d != 'thumbs' and not d.startswith('_')]
        for name in filenames:
            if name.startswith('_'):
                continue
            if os.path.splitext(name)[1].lower() not in EXTS:
                continue
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, IMG_DIR).replace('\\', '/')
            yield full, rel


def thumb_path(rel):
    return os.path.join(THUMB_DIR, os.path.splitext(rel)[0] + '.webp')


def is_fresh(full, out, record):
    """源文件的 size/mtime 与清单一致，且缩略图存在 → 不用重做。"""
    if not record or not os.path.exists(out):
        return False
    stat = os.stat(full)
    return (record.get('size') == stat.st_size
            and record.get('mtime') == int(stat.st_mtime))


def build(full, rel, max_side, quality):
    out = thumb_path(rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)

    with Image.open(full) as im:
        # GIF 等多帧图只取第一帧当封面
        if getattr(im, 'n_frames', 1) > 1:
            im.seek(0)
        im.load()

        has_alpha = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
        im = im.convert('RGBA' if has_alpha else 'RGB')

        w, h = im.size
        scale = max_side / float(max(w, h))
        if scale < 1:
            im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))),
                           Image.LANCZOS)

        im.save(out, 'WEBP', quality=quality, method=6)

    stat = os.stat(full)
    return {
        'size': stat.st_size,
        'mtime': int(stat.st_mtime),
        'w': im.size[0],
        'h': im.size[1],
        'thumb_bytes': os.path.getsize(out),
    }


def main():
    ap = argparse.ArgumentParser(description='生成 source/images/thumbs/*.webp')
    ap.add_argument('--force', action='store_true', help='忽略清单，全部重建')
    ap.add_argument('--only', action='append', default=[],
                    help='只处理指定文件（相对 source/images，或绝对/仓库相对路径）')
    ap.add_argument('--max', type=int, default=1000, help='长边像素，默认 1000')
    ap.add_argument('--quality', type=int, default=82, help='webp 质量，默认 82')
    ap.add_argument('--dry-run', action='store_true', help='只列出会做什么')
    args = ap.parse_args()

    if not os.path.isdir(IMG_DIR):
        sys.exit('找不到 %s' % IMG_DIR)

    only = set()
    for item in args.only:
        item = item.replace('\\', '/')
        for prefix in ('source/images/', 'images/', './'):
            if item.startswith(prefix):
                item = item[len(prefix):]
        only.add(item)

    manifest = load_manifest()
    seen = set()
    done = skipped = failed = 0
    before = after = 0

    for full, rel in iter_sources():
        if only and rel not in only:
            continue
        seen.add(rel)

        try:
            with Image.open(full) as probe:
                long_side = max(probe.size)
        except Exception as exc:                     # 损坏文件不阻断整批
            print('  ! %-42s 打不开：%s' % (rel, exc))
            failed += 1
            continue

        src_bytes = os.path.getsize(full)
        if src_bytes <= SKIP_BYTES and long_side <= SKIP_SIDE:
            skipped += 1
            manifest.pop(rel, None)
            continue

        out = thumb_path(rel)
        if not args.force and is_fresh(full, out, manifest.get(rel)):
            skipped += 1
            continue

        if args.dry_run:
            print('  · %-42s → %s' % (rel, os.path.relpath(out, THUMB_DIR)))
            continue

        try:
            record = build(full, rel, args.max, args.quality)
        except Exception as exc:
            print('  ! %-42s 生成失败：%s' % (rel, exc))
            failed += 1
            continue

        manifest[rel] = record
        done += 1
        before += src_bytes
        after += record['thumb_bytes']
        print('  ✓ %-42s %6.0f KB → %5.0f KB  %dx%d'
              % (rel, src_bytes / 1024, record['thumb_bytes'] / 1024,
                 record['w'], record['h']))

    # 源文件已删除 → 顺手清掉孤儿缩略图与清单记录
    for rel in list(manifest):
        if only and rel not in only:
            continue
        if rel not in seen:
            stale = thumb_path(rel)
            if not args.dry_run:
                try:
                    os.remove(stale)
                except OSError:
                    pass
                manifest.pop(rel, None)
            print('  - %-42s 源文件已删除，清理缩略图' % rel)

    if not args.dry_run:
        os.makedirs(THUMB_DIR, exist_ok=True)
        save_manifest(manifest)

    total_thumbs = sum(r.get('thumb_bytes', 0) for r in manifest.values())
    print('\n新增/更新 %d 张，跳过 %d 张，失败 %d 张' % (done, skipped, failed))
    if done:
        print('本次：%.1f MB → %.0f KB' % (before / 1048576, after / 1024))
    print('缩略图目录共 %d 张 / %.1f MB' % (len(manifest), total_thumbs / 1048576))


if __name__ == '__main__':
    main()
