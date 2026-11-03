@echo off
rem Run as administrator: starts the app automatically with Windows.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0service.ps1" -Action install %*
pause
