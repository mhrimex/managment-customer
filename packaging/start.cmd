@echo off
rem Runs the app in this window. Close the window to stop it.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-server.ps1" -Console
