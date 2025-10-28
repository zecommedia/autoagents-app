# 🎨 Cách Thay Đổi Icon Electron App

## Bước 1: Chuẩn bị icon

Bạn cần chuẩn bị các file icon sau:

### Windows:
- **icon.ico** (256x256px hoặc 512x512px) - Icon chính cho Windows
- **icon.png** (512x512px) - Icon PNG cho app

### Đặt icon vào thư mục:
```
autoagents-app/
├── public/
│   └── icon.png          ← Icon 512x512px PNG
└── electron/
    └── icon.ico          ← Icon Windows (optional)
```

## Bước 2: Cấu hình trong package.json

File `package.json` đã được cấu hình sẵn:

```json
"build": {
  "win": {
    "icon": "public/icon.png",  ← Đường dẫn icon
    "artifactName": "AutoAgents-Agent-${version}-portable.exe"
  }
}
```

## Bước 3: Tạo icon từ logo hiện tại

### Option A: Dùng online tool
1. Vào: https://www.icoconverter.com/
2. Upload file logo hiện tại (SVG hoặc PNG)
3. Chọn size: 256x256 hoặc 512x512
4. Download file .ico và .png

### Option B: Dùng ImageMagick
```bash
# Convert PNG to ICO
magick convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

### Option C: Photoshop/GIMP
1. Mở logo trong Photoshop/GIMP
2. Resize về 512x512px
3. Export as PNG và ICO

## Bước 4: Rebuild app

```bash
npm run build:electron
```

## Tạm thời: Dùng logo hiện tại

Nếu bạn muốn dùng logo-default.svg hiện tại, tôi sẽ tạo script để convert:

```bash
# Install sharp (nếu chưa có)
npm install sharp --save-dev

# Chạy script convert
node scripts/generate-icons.js
```

## Quick Fix: Tạo icon đơn giản

Tôi sẽ tạo một icon placeholder 512x512px từ logo SVG hiện tại của bạn.
