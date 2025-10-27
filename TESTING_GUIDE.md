# 🧪 Testing Guide - ### Step 2: Test Invalid License
1. Enter invalid key: `invalid-key-123`
2. Click "Activate License"
3. **Expected**: Error message "Invalid license key" appears
4. Button shows "Failed" state

### Step 3: Test Valid License (Free Tier)
1. Enter test license: `TEST-FREE-KEY-87654321`
2. Click "Activate License"
3. **Expected**:
   - Button shows loading spinner
   - API call to http://localhost:4000/auth/verify
   - Success → App transitions to main editor
   - Token saved to localStorage
   - User info displayed in header
   - **Free tier**: 10 usage limit

### Step 3b: Test Admin License (Unlimited)
1. Clear localStorage (DevTools → Application → Clear All)
2. Refresh app
3. Enter admin license: `ADMIN-TEST-KEY-12345678`
4. Click "Activate License"
5. **Expected**:
   - Success → App opens editor
   - **Enterprise tier**: Unlimited usage## Prerequisites

### Services Running:
- ✅ **Cloud API Server**: http://localhost:4000
- ✅ **Download Portal**: http://localhost:3002
- ✅ **Desktop App**: Running with `npx electron .`

---

## Test 1: License Activation 🔑

### Step 1: Open App
- App should show Login screen with:
  - "AutoAgents AI" title
  - "Desktop Edition" subtitle
  - License Key input field
  - "Activate License" button
  - Link to "auto-agents.org"

### Step 2: Test Invalid License
1. Enter invalid key: `invalid-key-123`
2. Click "Activate License"
3. **Expected**: Error message "Invalid license key" appears
4. Button shows "Failed" state

### Step 3: Test Valid License
1. Enter test license: `test-license-key-12345`
2. Click "Activate License"
3. **Expected**:
   - Button shows loading spinner
   - API call to http://localhost:4000/api/auth/verify
   - Success → App transitions to main editor
   - Token saved to localStorage
   - User info displayed in header

### Step 4: Test Auto Re-authentication
1. Close app (Ctrl+W or close window)
2. Restart app with `npx electron .`
3. **Expected**:
   - App automatically checks saved token
   - If valid → Goes directly to editor (skips login)
   - If expired → Shows login screen again

### Debugging:
- Open DevTools (already enabled)
- Check Console for errors
- Check Network tab for API calls:
  - POST http://localhost:4000/api/auth/verify
  - Should return 200 OK with token

---

## Test 2: Local Features (Offline) 🎨

Once logged in, test local processing:

### Feature: Remove Background
1. Upload an image (drag & drop or click upload)
2. Click "Remove BG" button (if available in toolbar)
3. **Expected**:
   - Processing runs locally (no API call)
   - Uses @imgly/background-removal library
   - Returns image with transparent background
   - Processing time: ~2-5 seconds

### Feature: Edge Detection
1. Upload an image
2. Click "Edge Detection" button
3. **Expected**:
   - Canvas-based edge detection
   - Returns black & white edge map
   - Instant processing

### Feature: Crop & Resize
1. Upload an image
2. Click "Crop" or "Resize"
3. Enter dimensions
4. **Expected**:
   - Canvas-based processing
   - Instant result
   - No API calls

---

## Test 3: Cloud Features (Online) ☁️

Test cloud AI endpoints:

### Feature: Redesign
1. Upload base image
2. Enter prompt: "modern minimalist living room"
3. Click "Redesign"
4. **Expected**:
   - API call to http://localhost:4000/api/cloud/redesign
   - Token included in Authorization header
   - Progress indicator shown
   - Result image returned
   - Usage counter decremented

### Feature: Clone Mode
1. Upload reference image
2. Upload target image
3. Click "Clone Pattern"
4. **Expected**:
   - API call to /api/cloud/clone
   - Pattern extracted and applied
   - Result returned

### Feature: Upscale
1. Upload low-res image
2. Select 2x or 4x scale
3. Click "Upscale"
4. **Expected**:
   - API call to /api/cloud/upscale
   - Higher resolution image returned

### Feature: Generate Video
1. Upload image
2. Enter motion prompt
3. Click "Generate Video"
4. **Expected**:
   - API call to /api/cloud/generate-video
   - Video file returned (MP4)
   - Longer processing time

---

## Test 4: Usage & Credits 📊

### Check Usage Display:
1. After login, check header
2. **Expected**: Shows "Credits: X / Y" or "Usage: X%"
3. After each cloud operation:
   - Counter should decrease
   - Update in real-time

### Check Limits:
1. Use all credits (if tier has limit)
2. Try another cloud operation
3. **Expected**:
   - Error: "Insufficient credits"
   - Prompt to upgrade tier
   - Local features still work

---

## Test 5: Portable .exe 📦

### Build Test:
1. Wait for electron-builder to finish
2. Check `electron-dist/` folder:
   ```powershell
   ls c:\autoagents-app\electron-dist\
   ```
3. **Expected**: `AutoAgents-Agent-1.0.0-portable.exe` (~110 MB)

### Run Test:
1. Close dev app (Ctrl+C terminal)
2. Run portable exe:
   ```powershell
   cd c:\autoagents-app\electron-dist
   .\AutoAgents-Agent-1.0.0-portable.exe
   ```
3. **Expected**:
   - App opens same as dev mode
   - All features work
   - No console errors

### Download Test:
1. Copy exe to download portal:
   ```powershell
   Copy-Item "c:\autoagents-app\electron-dist\AutoAgents-Agent-1.0.0-portable.exe" `
             "c:\autoagents-cloud\download-portal\downloads\windows\" -Force
   ```
2. Visit http://localhost:3002
3. Click "Download Windows (110 MB)"
4. **Expected**:
   - File downloads correctly
   - Size matches (~110 MB)
   - Can run after download

---

## Test 6: Error Handling ⚠️

### Network Errors:
1. Stop cloud API server:
   ```powershell
   # Kill process on port 4000
   Get-NetTCPConnection -LocalPort 4000 | ForEach-Object { 
       Stop-Process -Id $_.OwningProcess -Force 
   }
   ```
2. Try cloud feature
3. **Expected**:
   - Error message: "Cannot connect to server"
   - App doesn't crash
   - Local features still work

### Invalid Token:
1. Manually edit localStorage (DevTools → Application → Local Storage)
2. Change token to invalid value
3. Reload app
4. **Expected**:
   - Auto re-auth fails
   - Shows login screen
   - Can login again

---

## Test 7: DevTools Console Check 🔍

### No Errors Expected:
- ✅ No "Failed to load resources"
- ✅ No "Cannot find module"
- ✅ No React errors
- ✅ API calls return 200 OK

### Warnings Allowed:
- ⚠️ GPU cache warnings (non-critical)
- ⚠️ Tailwind CDN notice (for production, install as PostCSS plugin)

---

## Common Issues & Solutions

### Issue: "Network Error" on API calls
- **Solution**: Check if cloud API server is running on port 4000
- **Command**: `Test-NetConnection localhost -Port 4000`

### Issue: "Invalid token" on re-auth
- **Solution**: Clear localStorage and login again
- **DevTools**: Application → Local Storage → Clear All

### Issue: App crashes on startup
- **Solution**: Check terminal for error stack trace
- **Fix**: Rebuild with `npm run build && npx tsc`

### Issue: Portable .exe won't open
- **Solution**: Check Windows Defender/antivirus
- **Fix**: Add exception for .exe file

---

## Performance Benchmarks

### Expected Performance:
- **App startup**: < 3 seconds
- **Login API call**: < 1 second
- **Local remove BG**: 2-5 seconds
- **Local edge detection**: < 500ms
- **Cloud redesign**: 5-15 seconds
- **Cloud upscale**: 3-10 seconds

### Memory Usage:
- **Idle**: ~150-200 MB
- **Processing**: ~300-500 MB
- **Max acceptable**: < 1 GB

---

## Next Steps After Testing

### If All Tests Pass ✅:
1. **Disable DevTools** in electron/main.ts:
   ```typescript
   // Comment out this line:
   // mainWindow?.webContents.openDevTools();
   ```
2. **Build final .exe**
3. **Deploy to production**

### If Tests Fail ❌:
1. **Document the error** in FIX_LOG.md
2. **Check DevTools Console** for stack trace
3. **Report issue** with screenshots

---

Generated: October 26, 2025, 9:00 PM
