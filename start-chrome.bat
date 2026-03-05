@echo off
echo ============================================
echo   JobMatch AI - Start Chrome for Auto-Apply
echo ============================================
echo.
echo This will restart Chrome with remote debugging enabled.
echo All your existing tabs, bookmarks, and logins will be preserved.
echo.

:: Kill existing Chrome instances
echo Closing existing Chrome...
taskkill /F /IM chrome.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: Find Chrome
set CHROME_PATH=""
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
)
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH="%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
)

if %CHROME_PATH%=="" (
    echo ERROR: Chrome not found. Please install Google Chrome.
    pause
    exit /b 1
)

echo Starting Chrome with debugging on port 9222...
echo.
start "" %CHROME_PATH% --remote-debugging-port=9222 --restore-last-session

echo ✅ Chrome started with remote debugging!
echo.
echo Now run the engine:
echo   cd engine
echo   npm start
echo.
echo The engine will connect to THIS Chrome instance
echo with all your logins already active.
echo.
pause
