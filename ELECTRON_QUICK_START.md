# 🚀 Electron Desktop App - Quick Start

## ✅ Setup Complete!

Electron Desktop App đã được cấu hình xong! Bây giờ bạn có thể:
- Chạy Photoshop LOCAL trên máy user (không cần server)
- Tất cả xử lý file local (không upload lên server)
- 100% privacy - data không rời khỏi máy

## 📋 Checklist

- ✅ `electron/main.js` - Main process với Photoshop automation
- ✅ `electron/preload.js` - IPC security bridge  
- ✅ `electron/scripts/replacesmartobject.jsx` - JSX script cho Photoshop
- ✅ `package.json` - Cấu hình Electron build
- ✅ `cross-env` dependency - Đã cài đặt
- ✅ `MockupMode.tsx` - Updated với Electron detection

## 🎯 Test ngay!

### Bước 1: Khởi động Development Mode
```powershell
cd c:\autoagents-app

# Terminal 1: Start Vite dev server
npm run dev

# Terminal 2: Start Electron app
npm run dev:electron
```

### Bước 2: Test Photoshop Detection
1. Mở Desktop App (sẽ tự động mở window)
2. Vào Mockup Mode
3. Kiểm tra console:
   - Nếu thấy: `"✓ Photoshop detected at: C:\Program Files\Adobe\..."`
   - Và UI hiển thị: `🖥️ Desktop Mode` ở góc trên
   - ➡️ **Success!** Photoshop đã được detect

### Bước 3: Test Photoshop Processing
1. Upload POD design (PNG/JPG)
2. Upload PSD file (phải có layer "REPLACE" Smart Object)
3. Toggle **Photoshop Mode ON**
4. Click "Tạo Mockup"
5. Đợi 10-30 giây (Photoshop đang xử lý)
6. Kiểm tra kết quả

**Expected:**
- Console: `"🖥️ Processing with LOCAL Photoshop..."`
- Console: `"✓ Processed 1 mockups with local Photoshop"`
- UI hiển thị mockup đã xử lý
- Button "💾 Save" để lưu file

## 🏗️ Build Production App

```powershell
# Build executable
npm run build:electron

# Output: electron-dist/AutoAgents-Agent-1.0.0-portable.exe
```

**File output:**
- Windows: `.exe` file (portable, không cần install)
- Size: ~150-200 MB (bao gồm Electron + Chromium + Node.js)

## 🔍 Troubleshooting

### ❌ Photoshop not detected
**Check:**
```powershell
where photoshop.exe
```
Nếu không tìm thấy → Cài Adobe Photoshop 2018-2025

### ❌ "Could not get file paths"
**Cause:** File được drag/drop từ browser, không có path property

**Fix:** Trong Desktop app, nhất định phải:
1. Click button "Chọn file"
2. Chọn file từ Windows Explorer
3. Không drag & drop

### ❌ JSX script error
**Check:** `electron/scripts/replacesmartobject.jsx` có tồn tại không?
```powershell
Test-Path "c:\autoagents-app\electron\scripts\replacesmartobject.jsx"
```

### ❌ Electron won't start
```powershell
npm install electron --save-dev
npm run dev:electron
```

## 📊 Architecture

```
┌─────────────────────────────────────────┐
│   Electron Desktop App                  │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────────────────────────┐  │
│  │   Renderer Process (React)       │  │
│  │   - MockupMode.tsx               │  │
│  │   - window.electron APIs         │  │
│  └──────────────┬───────────────────┘  │
│                 │ IPC Communication     │
│                 ↓                        │
│  ┌──────────────────────────────────┐  │
│  │   Preload (contextBridge)        │  │
│  │   - Security bridge              │  │
│  └──────────────┬───────────────────┘  │
│                 │                        │
│                 ↓                        │
│  ┌──────────────────────────────────┐  │
│  │   Main Process (Node.js)         │  │
│  │   - checkPhotoshopInstalled()    │  │
│  │   - executePhotoshopScript()     │  │
│  │   - File system access           │  │
│  └──────────────┬───────────────────┘  │
│                 │                        │
└─────────────────┼────────────────────────┘
                  ↓
        ┌─────────────────────┐
        │  Adobe Photoshop    │
        │  + JSX Script       │
        └─────────────────────┘
```

## 🎨 Processing Flow

```
User clicks "Tạo Mockup" (Photoshop Mode ON)
    ↓
React: window.electron.processMockupsPhotoshop()
    ↓
IPC → Main Process
    ↓
Main: checkPhotoshopInstalled()
    ↓
Main: Save files to temp directory
    ↓
Main: Execute command:
    photoshop.exe -r "replacesmartobject.jsx"
    (with env var: MOCKUP_ARGS=psd|pod|output)
    ↓
Photoshop opens (no UI, background mode)
    ↓
JSX Script:
    1. Open PSD file
    2. Find "REPLACE" Smart Object layer
    3. Open Smart Object content (.psb)
    4. Place POD design
    5. Auto-scale & center
    6. Save Smart Object
    7. Export main PSD as PNG
    8. Output "SUCCESS"
    9. Quit Photoshop
    ↓
Main: Read PNG file → Convert to base64
    ↓
Main: Delete temp files
    ↓
IPC → React: Return processed images
    ↓
React: Display mockups
```

## 🎯 Features

### ✅ Implemented
- [x] Photoshop detection (10+ paths + fallback)
- [x] Local Photoshop execution (JSX script)
- [x] IPC communication (secure contextBridge)
- [x] File system access (native dialogs)
- [x] Desktop/Web mode detection
- [x] Save to disk functionality
- [x] Error handling

### ⚠️ Needs Testing
- [ ] Test with real PSD files
- [ ] Test with multiple PSDs
- [ ] Test error scenarios
- [ ] Test on different Windows versions

### 🚧 Future Enhancements
- [ ] macOS support
- [ ] Linux support
- [ ] Auto-updater
- [ ] Progress bars
- [ ] Settings persistence
- [ ] Custom JSX scripts

## 📝 Key Files

```
autoagents-app/
├── electron/
│   ├── main.js                    # ✅ DONE - Main process
│   ├── preload.js                 # ✅ DONE - IPC bridge
│   └── scripts/
│       └── replacesmartobject.jsx # ✅ DONE - Photoshop automation
│
├── src/
│   └── components/
│       └── MockupMode.tsx         # ✅ DONE - Electron integration
│
├── package.json                   # ✅ DONE - Build config
├── ELECTRON_DESKTOP_APP.md        # ✅ DONE - Full documentation
└── ELECTRON_QUICK_START.md        # ✅ DONE - This file
```

## 🔥 Next Steps

1. **Test now:**
   ```powershell
   npm run dev:electron
   ```

2. **Test with real PSD:**
   - PSD phải có layer tên "REPLACE" (Smart Object type)
   - Upload và test Photoshop Mode

3. **Build production:**
   ```powershell
   npm run build:electron
   ```
   - Test file `.exe` trong `electron-dist/`

4. **Distribute:**
   - Upload `.exe` lên server
   - Users download và chạy (portable app)

## 🎉 Success Indicators

✅ Desktop app mở được (window hiển thị React app)
✅ Console log: "🖥️ Desktop Mode: Checking local Photoshop..."
✅ UI hiển thị: "🖥️ Desktop Mode" badge
✅ Photoshop path hiển thị: "📁 C:\Program Files\Adobe\..."
✅ Toggle Photoshop Mode → Show: "✓ Local Photoshop - Edit Smart Object directly"
✅ Process mockup → Console: "✓ Processed 1 mockups with local Photoshop"
✅ Click Save → Native Windows save dialog mở
✅ File saved to chosen location

---

**Ready?** Chạy ngay: `npm run dev:electron` 🚀
