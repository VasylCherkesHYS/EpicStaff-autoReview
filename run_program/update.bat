@echo off
setlocal

echo =============================
echo   EpicStaff - Update Project
echo =============================
echo.

REM Run remove_containers first
call "%~dp0\remove_containers.bat"

REM Change to src directory
cd /d "%~dp0\..\src"

REM Build project
docker compose build

REM Create volumes
docker volume create crew_pgdata >nul 2>&1
docker volume create sandbox_venvs >nul 2>&1
docker volume create sandbox_executions >nul 2>&1
docker volume create crew_config >nul 2>&1

REM Start containers in detached mode
docker compose --project-name "epicstaff" up -d

REM Wait until all containers are healthy
echo [INFO] Waiting for containers to become healthy...
:wait_loop
for /f "tokens=*" %%s in ('docker ps --filter "health=unhealthy" --format "{{.ID}}"') do (
    timeout /t 2 >nul
    goto wait_loop
)

echo [OK] Update complete.

REM Remove containers again
call "%~dp0\remove_containers.bat"

pause
