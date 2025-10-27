@echo off
echo ===================================
echo  AutoAgents Desktop App - DEV MODE
echo ===================================
echo.

cd c:\autoagents-app

echo Starting Vite dev server...
echo.
echo App will be available at:
echo   http://localhost:5174/
echo.
echo Press Ctrl+C to stop the server
echo.

start http://localhost:5174

c:\autoagents-app\node_modules\.bin\vite.cmd

pause
