@echo off
setlocal
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8765" ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
  echo DSE local app stopped.
  exit /b 0
)
echo DSE local app is not currently running on port 8765.
endlocal
