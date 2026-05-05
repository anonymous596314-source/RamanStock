@echo off
chcp 65001 >nul
title 台股儀表板 - 本機伺服器

echo ============================================
echo   台股儀表板本機伺服器啟動中...
echo   請稍候，瀏覽器將自動開啟
echo ============================================
echo.

:: 嘗試用 Python 啟動
where python >nul 2>&1
if %errorlevel%==0 (
    echo [✓] 使用 Python HTTP 伺服器，Port 8080
    start "" "http://localhost:8080"
    python -m http.server 8080
    goto :end
)

:: 嘗試 python3
where python3 >nul 2>&1
if %errorlevel%==0 (
    echo [✓] 使用 Python3 HTTP 伺服器，Port 8080
    start "" "http://localhost:8080"
    python3 -m http.server 8080
    goto :end
)

:: 嘗試 Node.js npx serve
where npx >nul 2>&1
if %errorlevel%==0 (
    echo [✓] 使用 Node.js serve，Port 8080
    start "" "http://localhost:8080"
    npx -y serve -l 8080 .
    goto :end
)

:: 都沒有的話提示
echo.
echo [❌] 找不到 Python 或 Node.js！
echo.
echo 請安裝以下任一工具後重試：
echo   Python: https://www.python.org/downloads/
echo   Node.js: https://nodejs.org/
echo.
pause

:end
