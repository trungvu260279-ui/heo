@echo off
setlocal

:: Get current date and time for commit message
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set commit_msg=Auto backup: %datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2% %datetime:~8,2%:%datetime:~10,2%

echo [+] Adding changes...
git add .

echo [+] Committing changes: "%commit_msg%"
git commit -m "%commit_msg%"

echo [+] Pushing to main repository (origin)...
git push origin main

echo [+] Pushing to secondary backup (web_van)...
git push web_van main

echo [!] Done!
pause
