@echo off
setlocal

echo =============================
echo   EpicStaff - Remove Containers
echo =============================
echo.

REM List all containers with project name epicstaff and stop+remove them
for /f "tokens=*" %%c in ('docker ps -a --filter "name=epicstaff" --format "{{.ID}}"') do (
    echo [INFO] Stopping container %%c...
    docker stop %%c >nul 2>&1
    echo [INFO] Removing container %%c...
    docker rm %%c >nul 2>&1
)

echo [OK] All EpicStaff containers removed.

