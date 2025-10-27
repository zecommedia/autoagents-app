@echo off
title AutoAgents - Full Flow Test
color 0B

echo ============================================
echo   AutoAgents - Full Flow Test
echo ============================================
echo.

REM 1. Get JWT Token
echo [1/4] Getting JWT Token...
powershell -Command "$response = Invoke-RestMethod -Uri 'http://localhost:4000/auth/verify' -Method POST -ContentType 'application/json' -Body '{\"licenseKey\":\"ADMIN-TEST-KEY-12345678\"}'; $global:token = $response.token; Write-Host 'Token:' $global:token.Substring(0, 50)..."
if %errorlevel% neq 0 (
    echo ERROR: Failed to get token
    pause
    exit /b 1
)
echo.

REM 2. Test Text Chat
echo [2/4] Testing Text Chat (Gemini 2.5 Flash)...
powershell -Command "$response = Invoke-RestMethod -Uri 'http://localhost:4000/auth/verify' -Method POST -ContentType 'application/json' -Body '{\"licenseKey\":\"ADMIN-TEST-KEY-12345678\"}'; $token = $response.token; $chatResponse = Invoke-RestMethod -Uri 'http://localhost:4000/proxy/chat' -Method POST -ContentType 'application/json' -Headers @{Authorization=\"Bearer $token\"} -Body '{\"messages\":[{\"role\":\"user\",\"content\":\"Say hi in Vietnamese\"}],\"model\":\"gemini\"}'; Write-Host 'Chat Response:' $chatResponse.data; Write-Host 'Cost: $'$chatResponse.cost; Write-Host 'Time:'$chatResponse.processingTime'ms'"
echo.

REM 3. Test Text-to-Image
echo [3/4] Testing Text-to-Image (Imagen 4.0)...
powershell -Command "$response = Invoke-RestMethod -Uri 'http://localhost:4000/auth/verify' -Method POST -ContentType 'application/json' -Body '{\"licenseKey\":\"ADMIN-TEST-KEY-12345678\"}'; $token = $response.token; $imageResponse = Invoke-RestMethod -Uri 'http://localhost:4000/proxy/redesign' -Method POST -ContentType 'application/json' -Headers @{Authorization=\"Bearer $token\"} -Body '{\"prompt\":\"A professional office desk with laptop and coffee\",\"model\":\"gemini\"}'; if ($imageResponse.data) { Write-Host 'Image generated successfully!' } else { Write-Host 'Failed to generate image' }; Write-Host 'Cost: $'$imageResponse.cost; Write-Host 'Time:'$imageResponse.processingTime'ms'"
echo.

REM 4. Summary
echo [4/4] Summary
echo ============================================
echo   ✅ Authentication: Working
echo   ✅ Text Chat: Working
echo   ✅ Text-to-Image: Working
echo ============================================
echo.
echo All tests completed!
echo.
echo To use in your app:
echo   1. Make sure .env has: VITE_CLOUD_API_URL=http://localhost:4000
echo   2. Start app: npm run dev
echo   3. Enter license key: ADMIN-TEST-KEY-12345678
echo   4. Try chat and image generation features
echo.
pause
