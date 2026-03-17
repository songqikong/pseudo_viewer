#!/usr/bin/env bash
# 同时启动前后端：后端 http://localhost:8000，前端 http://localhost:5173
# 使用 Ctrl+C 会同时结束两个进程。

set -e
UI_ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo ""
  echo "正在关闭前后端..."
  [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

echo "启动后端 (FastAPI) -> http://localhost:8000"
cd "$UI_ROOT/backend"
python main.py &
BACKEND_PID=$!

echo "启动前端 (Vite) -> http://localhost:5173"
cd "$UI_ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "前后端已启动。浏览器访问: http://localhost:5173"
echo "按 Ctrl+C 结束。"
wait
