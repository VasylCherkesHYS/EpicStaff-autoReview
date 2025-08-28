@echo off
setlocal enabledelayedexpansion

set REPO_URL=https://github.com/EpicStaff/EpicStaff.git
set REPO_DIR=EpicStaff

:menu
cls
echo ==============================
echo EpicStaff Program Manager
echo ==============================
echo 1. Update program
echo 2. Run program
echo 3. Change version
echo 4. Stop system
echo 5. Exit
echo ==============================
set /p choice=Choose an option: 

if "%choice%"=="1" goto update
if "%choice%"=="2" goto run
if "%choice%"=="3" goto change_version
if "%choice%"=="4" goto stop_system
if "%choice%"=="5" exit /b
goto menu

:update
cls
if not exist "%REPO_DIR%" (
    echo Cloning repository...
    git clone %REPO_URL% %REPO_DIR%
)
pushd "%REPO_DIR%\run_program"
call update.bat
popd
goto menu

:run
cls
if not exist "%REPO_DIR%" (
    echo Repository not found. Cloning...
    git clone %REPO_URL% %REPO_DIR%
)
pushd "%REPO_DIR%\run_program"
call run.bat
popd
goto menu

:change_version
cls
if not exist "%REPO_DIR%" (
    echo Repository not found. Cloning...
    git clone %REPO_URL% %REPO_DIR%
)
pushd "%REPO_DIR%"
git fetch --all --tags

:version_menu
cls
echo ==============================
echo   EpicStaff - Choose Version
echo ==============================
echo 1. Checkout by Tag
echo 2. Checkout by Branch
echo 3. Back
echo ==============================
set /p choice=Enter choice (1-3): 

if "%choice%"=="1" goto choose_tag
if "%choice%"=="2" goto choose_branch
if "%choice%"=="3" (
    popd
    goto menu
)
goto version_menu

:choose_tag
cls
set PAGE=0
set COUNT=0
for /f "tokens=*" %%t in ('git tag --sort=-creatordate') do (
    set /a COUNT+=1
    set "tag!COUNT!=%%t"
)
set MAX=%COUNT%
goto show_tags

:show_tags
cls
echo ==============================
echo   Select Tag (page %PAGE%)
echo ==============================
set /a START=PAGE*10+1
set /a END=START+9
for /l %%i in (%START%,1,%END%) do (
    if %%i leq %MAX% (
        echo %%i. !tag%%i!
    )
)
echo N. Next page
echo P. Previous page
echo B. Back
echo.
set /p choice=Enter choice: 

if /i "%choice%"=="N" (
    set /a PAGE+=1
    goto show_tags
)
if /i "%choice%"=="P" (
    if %PAGE% gtr 0 set /a PAGE-=1
    goto show_tags
)
if /i "%choice%"=="B" goto version_menu

REM Checkout tag
for /f "tokens=*" %%i in ('echo %choice%') do (
    if defined tag%%i (
        cls
        git checkout !tag%%i!
        echo Switched to tag !tag%%i!
        pause
        goto version_menu
    )
)
goto show_tags

:choose_branch
cls
set PAGE=0
set COUNT=0
for /f "tokens=*" %%b in ('git branch -r --sort=-committerdate ^| findstr /v HEAD') do (
    set /a COUNT+=1
    set "branch!COUNT!=%%b"
)
set MAX=%COUNT%
goto show_branches

:show_branches
cls
echo ==============================
echo   Select Branch (page %PAGE%)
echo ==============================
set /a START=PAGE*10+1
set /a END=START+9
for /l %%i in (%START%,1,%END%) do (
    if %%i leq %MAX% (
        echo %%i. !branch%%i!
    )
)
echo N. Next page
echo P. Previous page
echo B. Back
echo.
set /p choice=Enter choice: 

if /i "%choice%"=="N" (
    set /a PAGE+=1
    goto show_branches
)
if /i "%choice%"=="P" (
    if %PAGE% gtr 0 set /a PAGE-=1
    goto show_branches
)
if /i "%choice%"=="B" goto version_menu

REM Checkout branch
for /f "tokens=*" %%i in ('echo %choice%') do (
    if defined branch%%i (
        cls
        for /f "tokens=2 delims=/" %%x in ("!branch%%i!") do (
            git checkout %%x
            echo Switched to branch %%x
        )
        pause
        goto version_menu
    )
)
goto show_branches

:stop_system
cls
if not exist "%REPO_DIR%" (
    echo Repository not found. Cloning...
    git clone %REPO_URL% %REPO_DIR%
)
pushd "%REPO_DIR%\run_program"
call remove_containers.bat
popd
echo System stopped.
pause
goto menu
