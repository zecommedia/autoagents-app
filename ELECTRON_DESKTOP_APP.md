# AutoAgents Desktop App - Electron Edition 🚀

## Tính năng

### ✅ Desktop App với Photoshop Local
- 🎨 **Photoshop Mode (Local)**: Chạy Photoshop trên máy user, không cần server
- ⚡ **Fast Mode (Browser)**: Client-side ag-psd processing
- 💾 **File System Access**: Truy cập files local, không upload lên server
- 🔒 **Privacy**: Tất cả xử lý trên máy local

## Cấu trúc Project

```
autoagents-app/
├── electron/
│   ├── main.js              # Electron main process
│   ├── preload.js           # Electron preload (bridge)
│   └── scripts/
│       └── replacesmartobject.jsx  # Photoshop JSX script
├── src/                     # React app source
├── dist/                    # Vite build output
└── electron-dist/           # Electron packaged app
```

## Kiến trúc

### Web App Mode (Hiện tại)
```
Browser (React)
    ↓
Fast Mode: ag-psd (client-side)
Photoshop Mode: Call server API → Server runs Photoshop
```

### Desktop App Mode (Mới)
```
Electron App (React + Node.js)
    ↓
Fast Mode: ag-psd (client-side) 
Photoshop Mode: Execute Photoshop LOCAL (no server needed!)
    ↓
window.electron.processMockupsPhotoshop()
    ↓
IPC → Main Process → Run Photoshop.exe + JSX
    ↓
Return processed images
```

## Installation

### 1. Install Dependencies
```bash
cd c:\autoagents-app
npm install
npm install cross-env --save-dev
```

### 2. Development Mode
```bash
# Start React app with Electron
npm run dev:electron

# Or run separately:
npm run dev              # Vite dev server (port 3000)
npm run dev:electron     # Electron (loads from port 3000)
```

### 3. Build Desktop App
```bash
# Build production app
npm run build:electron

# Output: electron-dist/AutoAgents-Agent-1.0.0-portable.exe
```

## How It Works

### 1. Photoshop Detection (Local)
```javascript
// In Electron main process
const psCheck = await checkPhotoshopInstalled();
// Checks 10+ installation paths + 'where photoshop.exe'
```

### 2. Process Mockups (Local Photoshop)
```javascript
// In React component
if (window.electron?.isElectron) {
  // Desktop app - use local Photoshop
  const result = await window.electron.processMockupsPhotoshop({
    podDesignPath: '/path/to/design.png',
    psdPaths: ['/path/to/mockup.psd']
  });
} else {
  // Web app - use Fast Mode or server API
  const result = await processPsdsClientSide(podDesign, psdFiles);
}
```

### 3. Photoshop Execution Flow
```
1. User clicks "Tạo Mockup" with Photoshop Mode ON
2. React calls window.electron.processMockupsPhotoshop()
3. IPC sends data to main process
4. Main process saves files to temp directory
5. Executes: photoshop.exe -r "replacesmartobject.jsx"
6. JSX script:
   - Opens PSD
   - Finds REPLACE Smart Object layer
   - Replaces content with POD design
   - Exports PNG
   - Quits Photoshop
7. Main process reads PNG, converts to base64
8. IPC sends result back to React
9. React displays processed images
```

## API Reference

### Electron Bridge (window.electron)

#### Check Photoshop
```javascript
const result = await window.electron.checkPhotoshop();
// Returns: { installed: boolean, path?: string }
```

#### Process Mockups with Photoshop
```javascript
const result = await window.electron.processMockupsPhotoshop({
  podDesignPath: string,  // Absolute path to POD design image
  psdPaths: string[]      // Array of absolute paths to PSD files
});
// Returns: { success: boolean, processedImages: [...], error?: string }
```

#### Save File Dialog
```javascript
const result = await window.electron.saveFileDialog({
  defaultPath: 'mockup.png',
  filters: [{ name: 'PNG Images', extensions: ['png'] }]
});
// Returns: { filePath: string, canceled: boolean }
```

#### Write File
```javascript
const result = await window.electron.writeFile({
  filePath: string,
  data: string  // base64 data URL
});
// Returns: { success: boolean, error?: string }
```

#### Get App Version
```javascript
const version = await window.electron.getAppVersion();
// Returns: string (e.g., "1.0.0")
```

#### Platform Detection
```javascript
window.electron.platform;  // 'win32', 'darwin', 'linux'
window.electron.isElectron;  // true (always true in desktop app)
```

## Updating MockupMode Component

### Add Electron Detection
```typescript
// src/components/MockupMode.tsx
const isElectron = typeof window.electron !== 'undefined' && window.electron.isElectron;

// Check Photoshop on component mount
useEffect(() => {
  if (isElectron) {
    window.electron.checkPhotoshop().then(result => {
      setPhotoshopAvailable(result.installed);
      if (result.installed) {
        console.log('✓ Photoshop detected at:', result.path);
      }
    });
  }
}, [isElectron]);
```

### Handle Process with Electron
```typescript
const handleProcess = async () => {
  if (usePhotoshop && photoshopAvailable && isElectron) {
    // Desktop app - local Photoshop execution
    console.log('🎨 Processing with local Photoshop...');
    
    // Save POD design to temp file
    const podDesignPath = await saveTempFile(podDesignFile);
    
    // Get PSD file paths (from file input or saved temp)
    const psdPaths = await Promise.all(
      psdFiles.map(file => saveTempFile(file))
    );
    
    const result = await window.electron.processMockupsPhotoshop({
      podDesignPath,
      psdPaths
    });
    
    if (result.success) {
      setProcessedImages(result.processedImages);
    } else {
      console.error('Photoshop processing failed:', result.error);
    }
  } else {
    // Web app or Fast Mode - existing code
    const results = await processPsdsClientSide(podDesignFile, psdFiles);
    setProcessedImages(results);
  }
};
```

## Building & Distribution

### Build Portable App
```bash
npm run build:electron
```

Output:
- `electron-dist/AutoAgents-Agent-1.0.0-portable.exe` (Windows)
- No installation needed - just run the .exe file

### File Size
- Compressed: ~150-200 MB
- Includes: Electron + Chromium + Node.js + React app + node_modules

### Distribution
1. Upload `AutoAgents-Agent-1.0.0-portable.exe` to your server
2. Users download and run
3. No installation wizard - portable app

## Testing

### Test Electron App
```bash
# 1. Start dev mode
npm run dev:electron

# 2. Test Photoshop detection
- Open app → Mockup Mode
- Check console for: "✓ Photoshop detected at: ..."

# 3. Test Photoshop processing
- Upload POD design
- Upload PSD file
- Toggle Photoshop Mode ON
- Click "Tạo Mockup"
- Wait 10-30 seconds
- Check results
```

### Test Checklist
- ✅ Photoshop detection works
- ✅ Can process PSD files locally
- ✅ Results display correctly
- ✅ Download button works
- ✅ Fast Mode fallback works
- ✅ Error handling works

## Troubleshooting

### Issue: "Photoshop not found"
**Solution**: Install Adobe Photoshop 2018-2025

### Issue: "JSX script not found"
**Solution**: Check `electron/scripts/replacesmartobject.jsx` exists

### Issue: "Electron app won't start"
**Solution**: 
```bash
npm install electron --save-dev
npm run dev:electron
```

### Issue: "Build failed"
**Solution**:
```bash
npm install electron-builder --save-dev
rm -rf node_modules
npm install
npm run build:electron
```

## Advantages of Desktop App

### vs Web App (Server-side Photoshop)
| Feature | Web App | Desktop App |
|---------|---------|-------------|
| Photoshop | Server-side | Local |
| Speed | Slow (upload/download) | Fast (local files) |
| Privacy | Data sent to server | 100% local |
| Server cost | High (Photoshop license) | Zero |
| Offline | ❌ Needs internet | ✅ Works offline |

### vs Web App (Fast Mode only)
| Feature | Web App | Desktop App |
|---------|---------|-------------|
| Quality | Good (ag-psd overlay) | Excellent (Smart Object) |
| Photoshop | ❌ Not available | ✅ Available |
| Installation | None needed | One-time download |
| Updates | Auto | Manual download |

## Next Steps

1. **Update MockupMode.tsx** to use Electron API
2. **Test on your machine** with real PSD files
3. **Build portable app** for distribution
4. **Create download page** on your website
5. **Add auto-updater** (optional) for future updates

## Development Roadmap

### Phase 1: Basic Desktop App ✅
- [x] Electron setup
- [x] Photoshop detection
- [x] Local JSX execution
- [x] IPC communication
- [x] File system access

### Phase 2: UI Integration (Next)
- [ ] Update MockupMode.tsx
- [ ] Add Electron detection
- [ ] Implement local file picker
- [ ] Update progress indicators
- [ ] Add desktop-specific UI

### Phase 3: Production Ready
- [ ] Error handling improvements
- [ ] Progress bars for Photoshop
- [ ] Multi-PSD batch processing
- [ ] Settings persistence
- [ ] Auto-updater

### Phase 4: Advanced Features
- [ ] macOS support
- [ ] Linux support
- [ ] Plugin system
- [ ] Custom JSX scripts
- [ ] Preset management

## Resources

- **Electron Docs**: https://www.electronjs.org/docs/latest
- **Electron Builder**: https://www.electron.build
- **IPC Communication**: https://www.electronjs.org/docs/latest/tutorial/ipc
- **Photoshop Scripting**: https://www.adobe.com/devnet/photoshop/scripting.html

## Support

Có vấn đề? Liên hệ team AutoAgents! 🚀

---

**Ready to test?** Run `npm run dev:electron` và test ngay! 🎉
