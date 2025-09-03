@echo off
setlocal EnableDelayedExpansion

set SRC_ENV=..\src\.env
set DEST_DIR=%APPDATA%\EpicStaff
set DEST_ENV=%DEST_DIR%\.env

echo ===============================
echo   EpicStaff - Sync .env
echo ===============================
echo.

if not exist "%SRC_ENV%" (
    echo [ERROR] Source .env file "%SRC_ENV%" not found!
    exit /b
)

if not exist "%DEST_DIR%" (
    mkdir "%DEST_DIR%"
    echo [INFO] Created directory %DEST_DIR%
)

if not exist "%DEST_ENV%" (
    echo [INFO] Creating new .env in %DEST_DIR%...
    type nul > "%DEST_ENV%"
)

echo [INFO] Merging with existing .env...
echo.

REM Load existing DEST_ENV into variables, ignore comments
for /f "usebackq tokens=1* delims==" %%A in (`findstr /v "^#" "%DEST_ENV%"`) do (
    set "DEST_%%A=%%B"
)

REM Process source env, ignore comments
for /f "usebackq tokens=1* delims==" %%A in (`findstr /v "^#" "%SRC_ENV%"`) do (
    set "key=%%A"
    set "value=%%B"

    if defined DEST_!key! (
        REM Key exists, check if value differs
        call set "current=%%DEST_!key!%%"
        if not "!current!"=="!value!" (
            echo [INFO] Key !key! exists with different value.
            echo       Current: !current!
            echo       Source : !value!
            echo.
            echo Choose an option for !key!:
            echo   1. Keep current value            !current!
            echo   2. Use new value from src/.env   !value! [default]
            set /p choice="Enter choice (1-2, default 2): "

            if "!choice!"=="1" (
                echo [INFO] Keeping existing value for !key!
            ) else (
                call :replace_line "%DEST_ENV%" "!key!" "!value!"
                set "DEST_!key!=!value!"
                echo [INFO] Updated !key! to !value!
            )
        )
    ) else (
        REM Key not found, add it
        echo [INFO] Adding new !key!=!value!
        echo !key!=!value!>>"%DEST_ENV%"
    )
)

echo.
echo [INFO] Merge complete.

exit /b

:replace_line
REM %1=file, %2=key, %3=newvalue
setlocal
set "file=%~1"
set "key=%~2"
set "value=%~3"

(for /f "usebackq tokens=1* delims==" %%i in (`findstr /v "^#" "%file%"`) do (
    if /i "%%i"=="%key%" (
        echo %key%=%value%
    ) else (
        echo %%i=%%j
    )
)) > "%file%.tmp"

REM Preserve original comments
findstr "^#" "%file%" >> "%file%.tmp"

move /y "%file%.tmp" "%file%" >nul
endlocal
pause
exit /b

