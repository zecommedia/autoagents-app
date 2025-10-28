# 🧪 Auto-Update Testing Guide

## Test Setup Complete ✅

Tôi đã thiết lập môi trường test cho auto-update system:

### 📦 Files Created:
1. **test-update-server.js** - Mock GitHub Releases API server
   - Runs on http://localhost:5555
   - Returns version 1.0.1 as latest
   - Serves latest.yml file for electron-updater

2. **TEST_AUTO_UPDATE.bat** - One-click test script
   - Starts mock server
   - Runs Electron app
   - Shows testing instructions

### ⚙️ Configuration Changes:

#### electron/updater.js
```javascript
// 🧪 DEVELOPMENT: Use mock update server
if (isDev) {
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'http://localhost:5555/repos/zecommedia/autoagents-app/releases/latest/download'
  });
}
```

#### electron/main.js
```javascript
// 🧪 TESTING: Enabled in development to test with mock server
mainWindow.webContents.once('did-finish-load', () => {
  setTimeout(() => {
    updater.checkForUpdates(false);
  }, 3000); // Wait 3 seconds before checking
});
```

## 🎯 How to Test:

### Option 1: Use Test Script (Recommended)
```bash
# Run this command:
.\TEST_AUTO_UPDATE.bat

# Wait for instructions to appear
# Press any key when ready
```

### Option 2: Manual Testing
```bash
# Terminal 1: Start mock server
node test-update-server.js

# Terminal 2: Run Electron app
npm run dev:electron

# Wait 3 seconds after app loads
```

## ✅ Expected Results:

### 1. After 3 seconds:
- Update dialog should appear
- Title: "Có bản cập nhật mới!"
- Message: "Phiên bản 1.0.1 đã có sẵn. Bạn có muốn tải về và cài đặt không?"
- Buttons: "Tải về ngay" and "Để sau"

### 2. Click "Tải về ngay":
- Should see progress dialog
- Shows download percentage
- Console logs download progress

### 3. After download completes:
- Dialog: "Cài đặt và khởi động lại"
- Message: "Cập nhật đã được tải về. Ứng dụng sẽ cài đặt và khởi động lại."
- Buttons: "Khởi động lại ngay" and "Khởi động lại sau"

### 4. Console Logs:
```
Auto-updater initialized
🧪 Using mock update server: http://localhost:5555
Checking for updates...
Update available: 1.0.1
Downloading update...
Update downloaded
```

### 5. Mock Server Logs:
```
📡 Update check from app version ...
📥 Request: GET /repos/.../releases/latest/download/latest.yml
```

## 🐛 Troubleshooting:

### If No Update Dialog Appears:
1. Check mock server is running (should see "Mock Update Server Started")
2. Check console for error messages
3. Verify app version is 1.0.0 in package.json
4. Check updater logs in console

### If Update Check Fails:
1. Make sure mock server started successfully
2. Check if port 5555 is available
3. Look for error messages in console
4. Try manually: In DevTools Console, run `window.electron.checkForUpdates()`

### Manual Update Check:
Open DevTools (Ctrl+Shift+I) and run:
```javascript
window.electron.checkForUpdates()
```

## 📝 Test Checklist:

- [ ] Mock server starts successfully
- [ ] Electron app launches
- [ ] Update dialog appears after 3 seconds
- [ ] Dialog text is in Vietnamese
- [ ] "Tải về ngay" button works
- [ ] Download progress shows
- [ ] Progress dialog updates percentage
- [ ] Download completes successfully
- [ ] Install dialog appears
- [ ] Console logs show all events
- [ ] Mock server receives requests

## 🎉 What This Tests:

✅ **Update Detection** - App can check for newer versions
✅ **Dialog UI** - Vietnamese messages display correctly
✅ **Download Flow** - User can download updates
✅ **Progress Tracking** - Shows download percentage
✅ **Install Prompt** - User can choose when to install
✅ **IPC Communication** - Main/Renderer communication works
✅ **Updater Module** - Auto-update logic is correct

## 🚀 Next Steps After Testing:

### For Production:
1. Remove development testing code:
   ```javascript
   // In electron/updater.js - Comment out or remove:
   if (isDev) {
     autoUpdater.setFeedURL({...});
   }
   
   // In electron/main.js - Restore:
   if (!isDev) {
     updater.checkForUpdates(false);
   }
   ```

2. Build production version:
   ```bash
   npm run build:electron
   ```

3. Create GitHub Release:
   - Tag: v1.0.1
   - Upload: dist/AutoAgents-Agent-Setup-1.0.1.exe
   - electron-updater will automatically use GitHub Releases

4. Distribute v1.0.0 to users
   - When they run app, it will detect v1.0.1
   - Auto-update will work with real GitHub Release

## 📊 Current Status:

✅ Mock server created and ready
✅ Updater configured for testing
✅ Main process checks for updates
✅ IPC handlers exposed
✅ Dialogs implemented in Vietnamese
✅ Test script created
⏳ Ready to test!

## 🎬 Test Now:

Run the test script and observe the auto-update flow:
```bash
.\TEST_AUTO_UPDATE.bat
```

The dialog should appear 3 seconds after the app window opens!
