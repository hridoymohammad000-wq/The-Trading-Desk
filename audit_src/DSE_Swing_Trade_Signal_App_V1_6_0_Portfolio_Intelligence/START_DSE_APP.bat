@echo off
setlocal
cd /d "%~dp0"
title DSE Swing Trade Signal App V1.4

where py >nul 2>&1
if %errorlevel%==0 (
  py -3 start_dse_app.py
) else (
  where python >nul 2>&1
  if not %errorlevel%==0 (
    echo.
    echo [ERROR] Python 3.10 or newer is required.
    echo Install Python and enable "Add Python to PATH", then run this file again.
    echo.
    pause
    exit /b 1
  )
  python start_dse_app.py
)

if not %errorlevel%==0 pause
endlocal
