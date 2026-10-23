@echo off
rem Job Copilot setup for Windows. Checks for the tools the project needs, offers
rem to install missing ones with winget, sets up the backend and builds the
rem Chrome extension. If it fails, follow docs\guide\setup.md instead.
setlocal EnableExtensions
title Job Copilot setup
cd /d "%~dp0"

echo.
echo  Job Copilot setup
echo  -----------------
echo  This checks your computer, offers to install anything missing,
echo  then sets up the backend and builds the Chrome extension.
echo.

set "INSTALLED="

rem Google Chrome loads the extension. The script only checks for it.
set "CHROME="
for %%P in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe") do if exist "%%~P" set "CHROME=%%~P"
if defined CHROME (echo  [ok] Google Chrome) else (echo  [!!] Google Chrome not found. Get it from https://www.google.com/chrome/ before loading the extension.)

rem uv runs the backend and downloads Python 3.12 for it, so Python is not needed separately.
where uv >nul 2>nul
if errorlevel 1 (
  call :offer_install uv astral-sh.uv
  if errorlevel 1 goto :stop
) else (
  echo  [ok] uv
)

rem Node.js 22 or newer builds the extension.
set "NODE_MAJOR=0"
for /f "tokens=1 delims=v." %%V in ('node -v 2^>nul') do set "NODE_MAJOR=%%V"
if %NODE_MAJOR% GEQ 22 (
  echo  [ok] Node.js %NODE_MAJOR%
) else (
  call :offer_install "Node.js 22" OpenJS.NodeJS.22
  if errorlevel 1 goto :stop
)

if defined INSTALLED goto :reopen

echo.
if exist ".env" (
  echo  [ok] .env already exists, left unchanged
) else (
  copy /y ".env.example" ".env" >nul || goto :fail
  echo  [ok] Created .env from .env.example. No AI key goes in it.
)

echo.
echo  Setting up the backend. The first run downloads Python 3.12 and packages, so it can take a few minutes.
pushd backend
uv sync --locked
if errorlevel 1 (popd & goto :fail)
popd

echo.
echo  Building the Chrome extension.
pushd extension
call npm ci --no-fund --no-audit
if errorlevel 1 (popd & goto :fail)
call npm run build
if errorlevel 1 (popd & goto :fail)
popd

echo.
echo  Setup finished.
echo.
echo  Load the extension in Chrome:
echo    1. Open chrome://extensions and turn on Developer mode, top right.
echo    2. Click Load unpacked and choose this folder:
echo       %CD%\extension\.output\chrome-mv3
echo    3. Right-click the Job Copilot icon and choose Options. Paste your BharatCode key,
echo       click Store key, then click Test connection.
echo.
echo  The backend must be running whenever you use Job Copilot. To start it later, run:
echo    cd /d "%CD%\backend"
echo    uv run uvicorn app.main:app --port 8000
echo.
set "ANSWER="
set /p "ANSWER= Start the backend now? Keep this window open while you use the extension. [Y/N] "
if /i not "%ANSWER%"=="Y" goto :done
cd backend
uv run uvicorn app.main:app --port 8000
goto :done

:offer_install
echo  [..] %~1 is missing or too old.
where winget >nul 2>nul
if errorlevel 1 (
  echo       winget is not available, so install %~1 yourself, then run setup.bat again.
  exit /b 1
)
set "ANSWER="
set /p "ANSWER=      Install %~1 now with winget? [Y/N] "
if /i not "%ANSWER%"=="Y" (
  echo       Install %~1 yourself, then run setup.bat again.
  exit /b 1
)
winget install --id %~2 -e --source winget
if errorlevel 1 exit /b 1
set "INSTALLED=1"
exit /b 0

:reopen
echo.
echo  New tools were installed. Close this window and double-click setup.bat again,
echo  so Windows can find them.
goto :done

:fail
echo.
echo  Setup stopped because the step above failed.
:stop
echo.
echo  You can still set up Job Copilot by hand: follow docs\guide\setup.md.
echo.
pause
exit /b 1

:done
echo.
pause
exit /b 0
