# 🔄 Auto-Update System - Phác Thảo Logic

## Kiến Trúc Tổng Quan

```
┌─────────────────────┐
│  Desktop App        │
│  (Client)           │
└──────┬──────────────┘
       │
       │ 1. Check for updates
       ↓
┌─────────────────────┐
│  Update Server      │
│  (GitHub Releases   │
│   hoặc Custom API)  │
└──────┬──────────────┘
       │
       │ 2. Return latest version info
       ↓
┌─────────────────────┐
│  App kiểm tra       │
│  Current vs Latest  │
└──────┬──────────────┘
       │
       │ 3. If update available
       ↓
┌─────────────────────┐
│  Show Update Dialog │
│  - Download Now     │
│  - Update Later     │
│  - Skip Version     │
└──────┬──────────────┘
       │
       │ 4. Download update
       ↓
┌─────────────────────┐
│  Install & Restart  │
└─────────────────────┘
```

## Các Phương Án Implement

### ⭐ Option 1: electron-updater (RECOMMENDED)
**Ưu điểm:**
- ✅ Tích hợp sẵn với electron-builder
- ✅ Auto-sign updates (bảo mật)
- ✅ Delta updates (chỉ download phần thay đổi)
- ✅ Support GitHub Releases tự động
- ✅ Background download
- ✅ Install silently hoặc với user prompt

**Nhược điểm:**
- ⚠️ Cần code signing certificate cho production
- ⚠️ Phức tạp hơn một chút

**Hosting Options:**
- GitHub Releases (FREE, easy)
- Custom S3/CDN
- Your own server

### Option 2: Custom Update Checker
**Ưu điểm:**
- ✅ Control hoàn toàn
- ✅ Không cần certificate
- ✅ Đơn giản

**Nhược điểm:**
- ❌ Phải tự implement download & install
- ❌ Ít bảo mật hơn
- ❌ Không có delta updates

---

## Implementation Plan với electron-updater

### Phase 1: Setup (15 phút)

**1.1. Install dependencies:**
```bash
npm install electron-updater --save
```

**1.2. Update package.json:**
```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "zecommedia",
      "repo": "autoagents-app"
    }
  }
}
```

**1.3. Create update configuration:**
```javascript
// electron/updater.js
const { autoUpdater } = require('electron-updater');

autoUpdater.autoDownload = false; // Manual download
autoUpdater.autoInstallOnAppQuit = true;

// Configure logging
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';
```

### Phase 2: Main Process Integration (20 phút)

**2.1. Add update check in main.js:**
```javascript
const { autoUpdater } = require('electron-updater');

// Check for updates after app ready
app.on('ready', () => {
  // Wait 3 seconds before checking
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 3000);
});

// Update events
autoUpdater.on('update-available', (info) => {
  // Show dialog: "New version available"
  dialog.showMessageBox({
    type: 'info',
    title: 'Có bản cập nhật mới',
    message: `Phiên bản ${info.version} đã có sẵn. Bạn có muốn tải về?`,
    buttons: ['Tải về', 'Để sau']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });
});

autoUpdater.on('update-downloaded', () => {
  // Show dialog: "Ready to install"
  dialog.showMessageBox({
    type: 'info',
    title: 'Cập nhật đã sẵn sàng',
    message: 'Cập nhật đã được tải về. Khởi động lại để cài đặt?',
    buttons: ['Khởi động lại', 'Để sau']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('download-progress', (progress) => {
  // Send progress to renderer
  mainWindow.webContents.send('download-progress', progress);
});
```

### Phase 3: UI Integration (30 phút)

**3.1. Create Update Dialog Component:**
```tsx
// src/components/UpdateDialog.tsx
const UpdateDialog = ({ visible, info, onDownload, onLater }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-md">
        <h2>🎉 Có bản cập nhật mới!</h2>
        <p>Phiên bản {info.version} đã có sẵn</p>
        <p className="text-sm text-gray-600">{info.releaseNotes}</p>
        <div className="flex gap-2 mt-4">
          <button onClick={onDownload}>Tải về ngay</button>
          <button onClick={onLater}>Để sau</button>
        </div>
      </div>
    </div>
  );
};
```

**3.2. Add IPC handlers:**
```javascript
// Preload
contextBridge.exposeInMainWorld('updates', {
  checkForUpdates: () => ipcRenderer.invoke('check-updates'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback)
});
```

### Phase 4: Release Process (10 phút)

**4.1. Build & Publish:**
```bash
# Build app
npm run build:electron

# Publish to GitHub Releases
# electron-builder will auto-upload if GH_TOKEN is set
export GH_TOKEN="your_github_token"
npm run build:electron -- --publish always
```

**4.2. Version bump:**
```json
// package.json
{
  "version": "1.0.1"  // Increment version
}
```

---

## Alternative: Simple Custom Update Checker

Nếu không muốn dùng electron-updater, đây là cách đơn giản:

```javascript
// electron/simpleUpdater.js
async function checkForUpdates() {
  try {
    const response = await fetch('https://api.github.com/repos/zecommedia/autoagents-app/releases/latest');
    const data = await response.json();
    
    const latestVersion = data.tag_name.replace('v', '');
    const currentVersion = app.getVersion();
    
    if (latestVersion > currentVersion) {
      // Show update dialog with download link
      return {
        available: true,
        version: latestVersion,
        downloadUrl: data.assets[0].browser_download_url
      };
    }
  } catch (error) {
    console.error('Update check failed:', error);
  }
}
```

---

## Recommendation

**Tôi khuyên dùng Option 1 (electron-updater)** vì:
1. ✅ Professional, proven solution
2. ✅ Tích hợp sẵn với GitHub Releases (free hosting)
3. ✅ Auto-signing và security
4. ✅ Delta updates tiết kiệm bandwidth

**Bạn muốn tôi implement Option nào?**
- [ ] Option 1: electron-updater (Pro, recommended)
- [ ] Option 2: Simple custom checker (Quick & dirty)

Cho tôi biết để tôi bắt tay vào code! 🚀
