@echo off
REM ============================================
REM Auto Update Download Portal with Latest Build
REM ============================================

echo.
echo ============================================
echo Updating Download Portal with Latest Build
echo ============================================
echo.

REM Check if electron-dist exists
if not exist "electron-dist\AutoAgents-Agent-1.0.0-portable.exe" (
    echo [ERROR] Build not found! Run BUILD_DESKTOP_APP.bat first
    pause
    exit /b 1
)

REM Get file size
for %%A in ("electron-dist\AutoAgents-Agent-1.0.0-portable.exe") do set fileSize=%%~zA
set /a fileSizeMB=%fileSize%/1048576

echo [1/4] Found build: %fileSizeMB% MB
echo.

REM Create downloads folder if not exists
if not exist "..\autoagents-cloud\download-portal\downloads\windows" (
    echo [2/4] Creating downloads folder...
    mkdir "..\autoagents-cloud\download-portal\downloads\windows"
) else (
    echo [2/4] Downloads folder exists
)

REM Copy .exe to download portal
echo [3/4] Copying file to download portal...
copy /Y "electron-dist\AutoAgents-Agent-1.0.0-portable.exe" "..\autoagents-cloud\download-portal\downloads\windows\"

if errorlevel 1 (
    echo [ERROR] Failed to copy file
    pause
    exit /b 1
)

REM Update versions.json
echo [4/4] Updating versions.json...
powershell -Command "$json = Get-Content '..\autoagents-cloud\download-portal\versions.json' | ConvertFrom-Json; $json.windows.fileSize = '%fileSizeMB% MB'; $json.windows.releaseDate = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ'); $json | ConvertTo-Json -Depth 10 | Set-Content '..\autoagents-cloud\download-portal\versions.json'"

echo.
echo ============================================
echo [SUCCESS] Download Portal Updated!
echo ============================================
echo.
echo File: AutoAgents-Agent-1.0.0-portable.exe
echo Size: %fileSizeMB% MB
echo Location: ..\autoagents-cloud\download-portal\downloads\windows\
echo.
echo Test download: http://localhost:3002
echo.
pause
