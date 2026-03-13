@echo off
setlocal enabledelayedexpansion
echo ================================================
echo   STUDENT AI - MULTI-VIEWPORT SIMULATOR
echo ================================================
echo.

set "LOCAL_URL=http://localhost:5173"

echo 1. Mobile Phone (375x667) - Standard iPhone
echo 2. Tablet (768x1024) - iPad Style
echo 3. Responsive Breakpoint (1000x700) - Sidebar Threshold
echo 4. Tiny Screen (300x300) - Stress Test
echo 5. Custom Window size
echo.
set /p choice="Chon loai thiet bi muon mo phong (1-5): "

if "%choice%"=="1" (
    set "W=375"
    set "H=667"
) else if "%choice%"=="2" (
    set "W=768"
    set "H=1024"
) else if "%choice%"=="3" (
    set "W=1000"
    set "H=700"
) else if "%choice%"=="4" (
    set "W=300"
    set "H=300"
) else if "%choice%"=="5" (
    set /p W="Width: "
    set /p H="Height: "
) else (
    echo [!] Lua chon khong hop le. Mac dinh chon Mobile.
    set "W=375"
    set "H=667"
)

:: Detect Browser Paths safely
set "CHROME_64=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHROME_32=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set "EDGE_64=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"

if exist "%CHROME_64%" (
    set "TARGET_BIN=%CHROME_64%"
    goto :launch
)
if exist "%CHROME_32%" (
    set "TARGET_BIN=%CHROME_32%"
    goto :launch
)
if exist "%EDGE_64%" (
    set "TARGET_BIN=%EDGE_64%"
    goto :launch
)

:launch_default
echo [!] Chrome/Edge not found in standard paths.
echo [*] Opening in default browser...
start %LOCAL_URL%
goto :end

:launch
echo [*] Launching: %TARGET_BIN%
echo [*] Viewport: %W%x%H%
start "" "%TARGET_BIN%" --window-position=50,50 --window-size=%W%,%H% --app="%LOCAL_URL%"

:end
echo.
echo [OK] Simulation window opened.
timeout /t 3
exit
