@echo off
setlocal

echo =============================
echo   EpicStaff - Run Project
echo =============================
echo.

REM Run remove_containers first
call "%~dp0\remove_containers.bat"

REM Change to src directory
cd /d "%~dp0\..\src"

REM Start containers in detached mode
docker compose --project-name "epicstaff" up -d

echo [OK] EpicStaff is running.
pause