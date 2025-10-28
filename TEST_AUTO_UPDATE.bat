@echo off
echo ====================================
echo Testing Auto-Update System
echo ====================================
echo.
echo Current Version: 1.0.0
echo Mock Server Version: 1.0.1
echo.
echo Step 1: Starting mock update server...
start "Mock Update Server" cmd /k "node test-update-server.js"
timeout /t 2 /nobreak >nul

echo Step 2: Running Electron app...
echo.
echo INSTRUCTIONS:
echo 1. Wait 3-5 seconds after app opens
echo 2. You should see update dialog "Có bản cập nhật mới! Phiên bản 1.0.1..."
echo 3. Click "Tải về ngay" to test download
echo 4. Check console logs for update progress
echo.
pause
npm run dev:electron
