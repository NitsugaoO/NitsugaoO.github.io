#!/bin/bash
# ============================================================================
# WooYun 博客辅助脚本
# ----------------------------------------------------------------------------
#   sync.sh "描述"          发布：add + commit + push（三步缺一不可）
#   sync.sh --serve         重新生成 + 重启预览服务器
#   sync.sh --restart       只重启预览服务器
#   sync.sh --check '#色值'  查该色值在生成的 CSS 里残留的位置（排查"改了没生效"）
#   sync.sh --status        查看构建状态
# ============================================================================

BLOG_DIR="C:/Users/Agustin/blog"
PORT=4000
PAGES_URL="https://nitsugaoo.github.io/"
CF_URL="https://blog.wooyun.workers.dev/"

cd "$BLOG_DIR" || { echo "❌ 找不到博客目录：$BLOG_DIR"; exit 1; }

# ---------------------------------------------------------------------------
# 重启本地预览服务器（Windows 下以独立窗口后台启动）
# ---------------------------------------------------------------------------
restart_server() {
  local pid
  pid=$(powershell -NoProfile -Command \
        "(Get-NetTCPConnection -LocalPort $PORT -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)" \
        2>/dev/null | tr -d '\r' | head -1)

  if [ -n "$pid" ]; then
    # //T 连整个进程树一起杀：hexo 进程的父级是那个 cmd 窗口，
    # 只杀 hexo 会留下一个空的黑窗口，重启几次就堆一堆。
    taskkill //F //T //PID "$pid" >/dev/null 2>&1 && echo "已停止旧的预览服务器 (PID $pid，含命令行窗口)"
  fi

  powershell -NoProfile -Command \
    "Start-Process cmd -ArgumentList '/c','cd /d C:\\Users\\Agustin\\blog && pnpm exec hexo server' -WindowStyle Minimized"

  sleep 14
  if curl -s -o /dev/null --max-time 10 "http://localhost:$PORT/"; then
    echo "✅ 预览服务器已就绪：http://localhost:$PORT"
  else
    echo "⚠️  服务器可能还在启动，稍等几秒再刷新"
  fi
}

case "$1" in

  # ---------------------------------------------------------------- 预览相关
  --serve|-s)
    echo "清理并重新生成..."
    pnpm exec hexo clean >/dev/null 2>&1
    pnpm exec hexo generate 2>&1 | tail -2
    restart_server
    ;;

  --restart|-r)
    restart_server
    ;;

  # ---------------------------------------------------------------- 诊断相关
  --check|-c)
    TARGET="$2"
    if [ -z "$TARGET" ]; then
      echo "用法：sync.sh --check '#色值'"
      exit 1
    fi
    echo "重新生成以确保 CSS 是最新的..."
    pnpm exec hexo generate >/dev/null 2>&1
    python - "$TARGET" <<'PYEOF'
import re, sys, pathlib

target = sys.argv[1].lower()
f = pathlib.Path('public/css/index.css')
if not f.exists():
    print("找不到 public/css/index.css，请先执行 hexo generate")
    sys.exit(1)

css = f.read_text(encoding='utf-8')
hits = []
for m in re.finditer(r'([^{}@]*)\{([^{}]*)\}', css):
    if target in m.group(2).lower():
        sel = ' '.join(m.group(1).split())
        hits.append(sel[:95])

print("「%s」在 index.css 中的定义：%d 条规则" % (target, len(hits)))
if not hits:
    print("   ✅ 该色值已完全消失")
else:
    for h in hits[:20]:
        print("   -", h)
    if len(hits) > 20:
        print("   …其余 %d 条已省略" % (len(hits) - 20))
    print()
    print("   注意：这些是主题 index.css 里的原始定义，不一定等于最终生效值。")
    print("   请依次判断：")
    print("     1) 若 everforest.css 里有同选择器的后加载规则 → 已被覆盖，正常")
    print("     2) 若它的选择器比你的覆盖规则更具体 → 需要复刻它的选择器")
    print("     3) 若它来自 HTML 内联样式 → 只能加 !important")
    print(r"   核实现值的办法：浏览器 F12 选中该元素，看 Computed 里的实际颜色")
PYEOF
    ;;

  --status|-t)
    echo "=== 最近 5 次构建 ==="
    gh run list --limit 5 2>&1
    echo
    echo "=== 线上可访问性 ==="
    printf "  GitHub Pages : "
    curl -s -o /dev/null -w "%{http_code}  (%{time_total}s)\n" --max-time 20 "$PAGES_URL"
    printf "  Cloudflare   : "
    curl -s -o /dev/null -w "%{http_code}  (%{time_total}s)\n" --max-time 20 "$CF_URL"
    ;;

  # ---------------------------------------------------------------- 帮助
  --help|-h)
    sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
    ;;

  # ---------------------------------------------------------------- 默认：发布
  *)
    MSG="${1:-更新博客}"
    echo "=== 暂存改动 ==="
    git add -A
    git diff --cached --stat | tail -5

    if git diff --cached --quiet; then
      echo "没有需要提交的改动（工作区干净）"
    else
      git commit -q -m "$MSG" && echo "✅ 已提交：$MSG"
    fi

    echo
    echo "=== 推送到 GitHub ==="
    # 注意：不能用 `git push | tail -3` 做判断 —— 管道的退出码是 tail 的，
    # 永远是 0，会把失败误报成成功（已踩过：SSL handshake 失败也报✅）。
    PUSH_LOG=$(git push 2>&1)
    PUSH_RC=$?
    echo "$PUSH_LOG" | tail -3

    if [ "$PUSH_RC" -eq 0 ]; then
      echo
      echo "✅ 已推送。1~2 分钟后自动部署到："
      echo "     GitHub Pages       $PAGES_URL"
      echo "     Cloudflare Workers $CF_URL"
      echo
      echo "   查看构建状态：bash \"$0\" --status"
    else
      echo "❌ 推送失败（退出码 $PUSH_RC）。常见原因：网络/代理抖动、SSH 证书、仓库权限。"
      echo "   提交已经做好，重跑一次 bash \"$0\" \"描述\" 即可重试推送。"
      exit 1
    fi
    ;;
esac
