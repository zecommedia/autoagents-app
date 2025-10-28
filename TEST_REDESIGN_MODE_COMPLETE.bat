@echo off
echo ========================================
echo REDESIGN MODE - COMPLETE TEST SCRIPT
echo ========================================
echo.

echo [1/5] Checking if Backend is running...
curl -s http://localhost:4000/health >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Backend NOT running!
    echo.
    echo Starting backend now...
    cd /d "c:\autoagents-cloud\cloud-api-server"
    start "Backend Server" cmd /k "npm start"
    echo.
    echo ⏳ Waiting 10 seconds for backend to start...
    timeout /t 10 /nobreak >nul
    echo.
)

echo ✅ Backend is running!
echo.

echo [2/5] Checking if Frontend is running...
curl -s http://localhost:5173 >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Frontend NOT running!
    echo.
    echo Starting frontend now...
    cd /d "c:\autoagents-app"
    start "Frontend Dev Server" cmd /k "npm run dev"
    echo.
    echo ⏳ Waiting 15 seconds for frontend to start...
    timeout /t 15 /nobreak >nul
    echo.
)

echo ✅ Frontend is running!
echo.

echo [3/5] Opening browser for testing...
start http://localhost:5173
echo.

echo [4/5] Test Checklist:
echo.
echo ══════════════════════════════════════
echo MANUAL REDESIGN FLOW TEST
echo ══════════════════════════════════════
echo.
echo 1️⃣  Upload test image (horror/animal design)
echo 2️⃣  Wait for suggestions to load (3-5 seconds)
echo 3️⃣  Check suggestions are DIVERSE:
echo     ✅ Different categories (Subject, Style, Mood, Color)
echo     ✅ Specific text (not generic "Variation 1, 2, 3")
echo     ✅ Vietnamese labels fit UI (3-4 words)
echo.
echo 4️⃣  Click one suggestion button
echo 5️⃣  Wait for 4 images to generate
echo 6️⃣  Verify images are DIFFERENT from each other
echo 7️⃣  Click left/right arrows to navigate variations
echo 8️⃣  Click "Apply" to use selected variation
echo.
echo ══════════════════════════════════════
echo SUGGESTION QUALITY CHECK
echo ══════════════════════════════════════
echo.
echo Test with HORROR design (e.g., clown):
echo   Expected suggestions:
echo   • 4 nhân vật kinh dị khác
echo   • 3 phong cách nghệ thuật
echo   • 4 cảnh tương phản
echo   • Bảng màu neon
echo.
echo Test with ANIMAL design (e.g., wolf):
echo   Expected suggestions:
echo   • 4 động vật hoang dã
echo   • Biến thành cyberpunk
echo   • 4 thần thoại
echo   • Các thời đại
echo.
echo Test with ABSTRACT design:
echo   Expected suggestions:
echo   • 4 hình học khác
echo   • Biến thành tự nhiên
echo   • Văn hóa thế giới
echo   • 4 cảm xúc màu
echo.
echo ══════════════════════════════════════
echo CONSOLE CHECKS
echo ══════════════════════════════════════
echo.
echo Open DevTools (F12) and check console:
echo.
echo ✅ Should see:
echo    "🎨 Detailed prompts result: {success: true, data: Array(4)}"
echo.
echo ❌ Should NOT see:
echo    "Variation 1, Variation 2, Variation 3"
echo    (This means fallback mock data - API failed!)
echo.

echo [5/5] Performance Targets:
echo.
echo ⏱️  Suggestion load: ^< 5 seconds
echo ⏱️  Image generation: ^< 30 seconds (4 images)
echo ✨ Click rate goal: +30%% vs old suggestions
echo 🎨 Variation quality: +25%% user satisfaction
echo.

echo ========================================
echo TEST COMPLETE! Review results above.
echo ========================================
echo.
echo Press any key to exit...
pause >nul
