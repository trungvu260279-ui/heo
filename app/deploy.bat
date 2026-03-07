@echo off
echo ==========================================
echo   TRIEN KHAI UNG DUNG LEN VERCEL
echo ==========================================
echo.

cd /d "%~dp0"

echo 1. Kiem tra trang thai dang nhap...
call npx vercel whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Ban chua dang nhap Vercel. dang tien hanh dang nhap...
    call npx vercel login
)

echo 2. Dang deploy len Production...
call npx vercel --prod --yes

if %errorlevel% equ 0 (
    echo.
    echo [OK] Da deploy thanh cong! 
    echo Hay mo link Production de kiem tra.
) else (
    echo.
    echo [LOI] Co loi xay ra trong qua trinh deploy.
)

pause
