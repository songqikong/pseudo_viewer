@echo off
chcp 65001 >nul
echo 启动 Pseudo-Label Generator GUI...
echo.

set "UI_ROOT=%~dp0"
set "BACKEND_PID="
set "FRONTEND_PID="

echo 启动后端 (FastAPI) -> http://localhost:8000
start "Backend" cmd /k "cd /d "%UI_ROOT%backend" && python main.py"
timeout /t 2 /nobreak >nul

echo 启动前端 (Vite) -> http://localhost:5173
start "Frontend" cmd /k "cd /d "%UI_ROOT%frontend" && npm run dev"
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo 前后端已启动
echo 后端: http://localhost:8000
echo 前端: http://localhost:5173
echo ========================================
echo 按任意键结束所有进程...
pause >nul

taskkill /F /IM python.exe /T >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1
echo 已关闭所有进程
