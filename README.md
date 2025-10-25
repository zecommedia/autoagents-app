# 🎨 AutoAgents Desktop App

Professional image editing and AI-powered design tool.

## ✨ Features

### Local Processing (Offline, Free)
- 🎯 Remove Background (REMBG AI Model)
- ✏️ Pen Tool (Bezier curves)
- 🎨 Clone Mode (Stamp tool)
- 🔍 Edge Detection
- 🎨 Color Picker
- 📐 Layers System

### Cloud Processing (AI-Powered)
- 🤖 Redesign Mode (Gemini AI)
- 🎬 Video Generation
- 📱 Mockup Generator
- ⬆️ Image Upscaling
- 🎨 Canvas Fill (Inpainting)

## 🚀 Quick Start

### For Users

1. Download latest release from: [Releases](https://github.com/zecommedia/autoagents-app/releases)
2. Install `AutoAgents-Setup.exe`
3. Launch app
4. Enter your license key
5. Start creating!

### For Developers

```bash
# Install dependencies
npm install

# Run dev mode
npm run dev

# Build for Windows
npm run build:electron

# Build for all platforms
npm run build:all
```

## 📦 Build from Source

### Windows
```bash
build\build-windows.bat
```

### macOS
```bash
chmod +x build/build-mac.sh
./build/build-mac.sh
```

### Linux
```bash
chmod +x build/build-linux.sh
./build/build-linux.sh
```

## 📚 Documentation

- [User Guide](docs/USER_GUIDE.md)
- [Pen Tool Guide](docs/PEN_TOOL_QUICKSTART_VI.md)
- [Clone Mode Guide](docs/CLONE_MODE_IMPROVEMENTS.md)
- [Mockup Guide](docs/MOCKUP_MODE_DOCUMENTATION.md)

## 🔧 Requirements

- Node.js 18+
- Windows 10+ / macOS 10.15+ / Linux (Ubuntu 20.04+)

## 🏗️ Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Desktop**: Electron
- **Local Processing**: WASM (REMBG), Canvas API
- **Cloud API**: Express.js proxy
- **Styling**: TailwindCSS

## 📞 Support

- Email: support@zecommedia.com
- Docs: `/docs` folder
- Issues: GitHub Issues

## 📄 License

Proprietary - Requires license key to use.

---

Generated: 2024-10-25
