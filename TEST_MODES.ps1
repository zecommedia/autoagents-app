#!/usr/bin/env pwsh
# Quick Test Script for All Modes

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "AutoAgents Mode Testing Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if servers are running
Write-Host "[1/4] Checking Cloud API Server (port 4000)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4000/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Cloud API Server is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Cloud API Server not running!" -ForegroundColor Red
    Write-Host "   Start with: cd c:\App\autoagents-cloud\cloud-api-server; npm start" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "[2/4] Checking Frontend Dev Server (port 5173)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Frontend Dev Server is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Frontend Dev Server not running!" -ForegroundColor Red
    Write-Host "   Start with: cd c:\App\autoagents-app; npm run dev" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host ""
Write-Host "[3/4] Refactor Status:" -ForegroundColor Yellow
Write-Host "   ✅ Redesign Mode - Using cloudApiService.redesign()" -ForegroundColor Green
Write-Host "   ✅ Video Mode - Using cloudApiService.generateVideo()" -ForegroundColor Green
Write-Host "   ✅ Canvas Mode - Using cloudApiService.textToImage()" -ForegroundColor Green
Write-Host "   ⭐ Clone Mode - REFACTORED to use cloudApiService.upscale()" -ForegroundColor Cyan
Write-Host ""

Write-Host "[4/4] Test Checklist:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Priority Test - Clone Mode (Newly Refactored):" -ForegroundColor Magenta
Write-Host "   1. Open http://localhost:5173" -ForegroundColor White
Write-Host "   2. Login with license key" -ForegroundColor White
Write-Host "   3. Switch to Clone mode" -ForegroundColor White
Write-Host "   4. Upload a design/logo/sticker image" -ForegroundColor White
Write-Host "   5. Wait for processing (cloning → detecting → upscaling → done)" -ForegroundColor White
Write-Host "   6. Verify:" -ForegroundColor White
Write-Host "      ✅ No 'upscaleImage is not defined' error" -ForegroundColor Green
Write-Host "      ✅ No localhost:5000 connection errors" -ForegroundColor Green
Write-Host "      ✅ Final image has transparent background" -ForegroundColor Green
Write-Host "      ✅ High quality (2x upscaled)" -ForegroundColor Green
Write-Host ""

Write-Host "Standard Tests:" -ForegroundColor Magenta
Write-Host "   □ Redesign Mode - Test AI Eraser, Inpainting, Manual Redesign" -ForegroundColor White
Write-Host "   □ Video Mode - Test video generation from image + prompt" -ForegroundColor White
Write-Host "   □ Canvas Mode - Test text-to-image, multi-image composition" -ForegroundColor White
Write-Host ""

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Documentation:" -ForegroundColor Cyan
Write-Host "   📖 Detailed Guide: MODE_REFACTOR_TEST_GUIDE.md" -ForegroundColor White
Write-Host "   📖 Vietnamese Summary: REFACTOR_SUMMARY_VI.md" -ForegroundColor White
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ready to test! Open http://localhost:5173 to begin." -ForegroundColor Green
Write-Host ""
