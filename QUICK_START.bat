@echo off
echo ===================================================
echo  AutoAgents Desktop App - Quick Start
echo ===================================================
echo.
echo What would you like to do?
echo.
echo [1] Open Download Portal (http://localhost:3002)
echo [2] Run Built Desktop App (.exe)
echo [3] Start Dev Server (with hot reload)
echo [4] View Integration Guide
echo [5] View Phase 1 Summary
echo [6] Exit
echo.
set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" (
    echo.
    echo Opening download portal...
    start http://localhost:3002
    goto menu
)

if "%choice%"=="2" (
    echo.
    echo Launching desktop app...
    if exist "electron-dist\AutoAgents-Agent-1.0.0-portable.exe" (
        start "" "electron-dist\AutoAgents-Agent-1.0.0-portable.exe"
    ) else (
        echo ERROR: .exe file not found!
        echo Please run BUILD_DESKTOP_APP.bat first
    )
    goto menu
)

if "%choice%"=="3" (
    echo.
    echo Starting dev server...
    echo Press Ctrl+C to stop
    npm run dev
    goto menu
)

if "%choice%"=="4" (
    echo.
    echo Opening integration guide...
    start INTEGRATION_GUIDE.md
    goto menu
)

if "%choice%"=="5" (
    echo.
    echo Opening phase 1 summary...
    start PHASE1_SUMMARY.md
    goto menu
)

if "%choice%"=="6" (
    echo.
    echo Goodbye!
    exit
)

echo.
echo Invalid choice. Please try again.
echo.

:menu
echo.
echo Press any key to return to menu...
pause > nul
cls
goto start

:start
goto :eof
