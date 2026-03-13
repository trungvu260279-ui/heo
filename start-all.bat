@echo off
echo ================================================
echo   THPT KIM XUYEN - FULL STACK DEV (Local)
echo ================================================
echo.
echo [*] Starting Backend (Port 10000)...
start "Backend" cmd /k "cd backend && npm run dev"

echo [*] Starting Frontend (Port 5173)...
echo [*] If browser doesn't open, visit: http://localhost:5173
echo.
cd app && npm run dev
timeout /t 5
pause
