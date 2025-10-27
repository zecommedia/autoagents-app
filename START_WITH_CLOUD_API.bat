@echo off
title AutoAgents - Start with Cloud API
color 0E

echo ============================================
echo   AutoAgents - Starting with Cloud API
echo ============================================
echo.

REM Check if server is running
echo Checking Cloud API Server...
curl http://localhost:4000/health >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Cloud API Server is not running!
    echo.
    echo Please start the server first:
    echo   cd ..\autoagents-cloud\cloud-api-server
    echo   node server.js
    echo.
    pause
    exit /b 1
)

echo ✅ Cloud API Server is running
echo.

REM Check .env configuration
if not exist ".env" (
    echo Creating .env file...
    echo VITE_CLOUD_API_URL=http://localhost:4000> .env
    echo VITE_APP_ENV=development>> .env
    echo ✅ .env created
    echo.
)

echo Starting AutoAgents App...
echo.
echo ============================================
echo   Configuration:
echo   - Cloud API: http://localhost:4000
echo   - License Key: ADMIN-TEST-KEY-12345678
echo ============================================
echo.

npm run dev
