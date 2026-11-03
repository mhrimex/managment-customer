@echo off
rem Run as administrator: restarts the app (e.g. after editing settings.env).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0service.ps1" -Action restart
pause
