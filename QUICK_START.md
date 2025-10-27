# Desktop App Quick Start

## 📦 Install Dependencies

```powershell
cd c:\autoagents-app
npm install
```

## 🚀 Development

```powershell
# Run React app (port 3000)
npm run dev

# Run local server (port 4000)
npm run dev:local-server

# Run both
npm run dev:all

# Run Electron in dev mode
npm run dev:electron
```

## 🏗️ Build

```powershell
# Build production
npm run build

# Build Electron app (.exe)
npm run build:electron
```

Output: `electron-dist/AutoAgents-Agent-1.0.0-portable.exe`

## 🔑 Configure API URL

Development (localhost):
- Edit `.env.development`
- `CLOUD_API_URL=http://localhost:4000`

Production (tunnel):
- Edit `.env.production`
- `CLOUD_API_URL=https://api-ditech.auto-agents.org`

## 🧪 Test Flow

1. **Start Cloud API**:
   ```powershell
   cd c:\autoagents-cloud\cloud-api-server
   npm start
   ```

2. **Start Tunnel** (if testing production):
   ```powershell
   cd c:\autoagents-cloud
   .\START_TUNNEL.bat
   ```

3. **Start Desktop App**:
   ```powershell
   cd c:\autoagents-app
   npm run dev
   ```

4. **Test Features**:
   - Local features (Remove BG, Edge Detection) → Should work offline
   - Cloud features (AI Redesign, Upscale) → Need license key + internet

## 📂 Project Structure

```
autoagents-app/
├── lib/
│   ├── config/
│   │   └── cloudApiConfig.ts      # API configuration
│   └── services/
│       ├── cloudAuthService.ts    # Authentication service
│       └── cloudApiService.ts     # Cloud API calls
├── electron/
│   ├── main.ts                    # Electron main process
│   └── preload.ts                 # IPC bridge
├── components/                     # React components
├── .env.development               # Dev config
├── .env.production                # Prod config
├── package.json                   # Dependencies & build config
└── vite.config.ts                 # Vite configuration
```

## 🔐 License Key Flow

1. User opens app → Login screen
2. User enters license key
3. App calls `/auth/verify` with license key + machine ID
4. Server returns JWT token (30 days)
5. Token saved to localStorage
6. Token included in all API requests
7. If token expires → Re-authenticate with saved license

## 🌐 API Endpoints

Local (free, offline):
- Remove background: `@imgly/background-removal`
- Edge detection: Canvas API
- Crop/resize: Sharp library

Cloud (paid, online):
- AI Redesign: `POST /proxy/redesign`
- AI Clone: `POST /proxy/redesign` (2 images)
- Upscale: `POST /proxy/upscale`
- Video Gen: `POST /proxy/video`

## 📊 Usage Tracking

- Each cloud API call includes usage info in response
- Client shows remaining credits
- Server tracks usage in database

## 🔄 Next Steps

1. ✅ Install dependencies
2. ✅ Test dev mode
3. ⏳ Build production
4. ⏳ Test built .exe
5. ⏳ Setup download portal
