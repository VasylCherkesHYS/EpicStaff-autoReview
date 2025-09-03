@echo off
setlocal

set SRC_ENV=..\src\.env
set DEST_DIR=%APPDATA%\EpicStaff
set DEST_ENV=%DEST_DIR%\.env

echo ===============================
echo   EpicStaff - Replace src/.env
echo ===============================
echo.

if not exist "%DEST_ENV%" (
    echo [ERROR] .env not found in %DEST_DIR%
    pause
    exit /b
)

echo [INFO] Replacing %SRC_ENV% with %DEST_ENV%...
copy /Y "%DEST_ENV%" "%SRC_ENV%" >nul
echo [INFO] Replacement complete.
pause
exit /b
