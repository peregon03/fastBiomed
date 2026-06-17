@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0crear_backup.ps1"
pause
