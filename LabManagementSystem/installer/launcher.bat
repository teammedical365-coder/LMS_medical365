@echo off
title LMS Medical365 - Local Edition Management Console
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\manage-lms.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo An unexpected error occurred while executing the management console.
    pause
)
