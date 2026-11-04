@echo off
REM Re-apply dsh-purge 1.1.71 compatibility patches, then launch DeepSeek Harness.
REM Idempotent: safe to double-click any time, especially after a plugin reinstall/update.
REM Set DSH_DESKTOP_HOME to your DeepSeek Harness install folder if it is not D:\DeepSeek.
setlocal
set "HERE=%~dp0"
if "%DSH_DESKTOP_HOME%"=="" set "DSH_DESKTOP_HOME=D:\DeepSeek"

echo Applying dsh-purge 1.1.71 compatibility patches ...
node "%HERE%fix-dsh-purge-1.1.71.cjs"
if errorlevel 1 (
  echo Patch step reported a problem - see the output above.
  pause
  exit /b 1
)

echo Launching DeepSeek Harness ...
start "" "%DSH_DESKTOP_HOME%\DeepSeek Harness.exe"
echo Done.
"%SystemRoot%\System32\timeout.exe" /t 5 >nul
