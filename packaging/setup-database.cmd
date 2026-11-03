@echo off
rem Creates the database, tables, view, stored procedures and default users.
rem Uses DATABASE_URL from settings.env. Safe to run again (never deletes data).
rem   setup-database.cmd           -> empty system
rem   setup-database.cmd -Sample   -> plus demo data
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-database.ps1" %*
echo.
pause
