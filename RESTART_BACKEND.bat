@echo off
echo ========================================
echo  RESTART BACKEND SERVER
echo  (Apply new endpoint changes)
echo ========================================
echo.

cd /d "c:\autoagents-cloud\cloud-api-server"

echo [1/3] Stopping existing server...
taskkill /F /IM node.exe 2>nul
timeout /t 2 >nul

echo [2/3] Starting backend server...
start "AutoAgents Backend" cmd /k "npm start"
timeout /t 3 >nul

echo [3/3] Checking server health...
curl http://localhost:4000/health
echo.

echo ========================================
echo  Backend server restarted!
echo  Check the new terminal window for logs
echo ========================================
echo.
echo New endpoint available:
echo   POST /proxy/detailed-redesign-prompts
echo.
echo Next: Open http://localhost:5173 and test!
echo.
pause
