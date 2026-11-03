@echo off
rem Run as administrator: stops the app and removes the automatic start.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0service.ps1" -Action uninstall
pause
