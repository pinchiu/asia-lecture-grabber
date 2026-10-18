@echo off
chcp 65001 >nul
title 亞洲大學講座報名與畢業門檻助手
cd /d "%~dp0"

echo ========================================================
echo   亞洲大學講座自動報名助手與畢業素養門檻追蹤系統
echo   服務位址：http://127.0.0.1:5199
echo   若要在手機使用，請確保手機與電腦連線同一個 Wi-Fi
echo ========================================================
echo.

start "" /min cmd /c "timeout /t 2 >nul & start http://127.0.0.1:5199"
node src/server.mjs

pause
