# ☁️ Remote Cloud API Support - Analysis & Implementation

## Câu Hỏi: Desktop app tải về ở máy khác có hoạt động không?

**✅ CÓ - Nhưng cần config!**

---

## Hiện Tại: Local-only Setup

```
┌──────────────┐
│ Desktop App  │
│ (Client)     │ ────→ http://localhost:4000
└──────────────┘
       │
       │ Same machine only
       ↓
┌──────────────┐
│ Cloud Server │
│ Port 4000    │
└──────────────┘
```

**Vấn đề:** App chỉ connect localhost, không work trên máy khác!

---

## Giải Pháp: Cloudflare Tunnel + Config

```
┌──────────────┐
│ Desktop App  │
│ (Máy A)      │ ────→ https://api-ditech.auto-agents.org
└──────────────┘
       │
       │ Internet
       ↓
┌──────────────┐
│ Cloudflare   │
│ Tunnel       │
└──────┬───────┘
       │
       │ Forward to
       ↓
┌──────────────┐
│ Cloud Server │
│ (Máy B)      │
│ Port 4000    │
└──────────────┘
```

---

## Implementation Steps

### Step 1: Setup Environment Variables

**Thêm vào `.env` trong app:**
```env
# API Configuration
VITE_API_URL=https://api-ditech.auto-agents.org
VITE_API_MODE=cloud  # or "local"
```

**Hoặc trong production build:**
```env
REACT_APP_API_URL=https://api-ditech.auto-agents.org
```

### Step 2: Update API Service

**Tạo `src/config/api.ts`:**
```typescript
// Auto-detect API URL
export const API_CONFIG = {
  // Check if running in Electron with remote API
  baseURL: import.meta.env.VITE_API_URL || 
           process.env.REACT_APP_API_URL ||
           'http://localhost:4000',
  
  timeout: 30000,
  
  // Check if API is available
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
};

// Export for use in services
export const API_BASE = API_CONFIG.baseURL;
```

**Update các services sử dụng API:**
```typescript
// src/services/cloudApiService.ts
import { API_BASE } from '../config/api';

export async function processMockup(data: FormData) {
  const response = await fetch(`${API_BASE}/api/mockup/process`, {
    method: 'POST',
    body: data
  });
  return response.json();
}
```

### Step 3: Setup Cloudflare Tunnel

**3.1. Install cloudflared:**
```bash
# Windows
winget install cloudflare.cloudflared

# Or download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

**3.2. Login to Cloudflare:**
```bash
cloudflared tunnel login
```

**3.3. Create tunnel:**
```bash
# Create tunnel named "autoagents-api"
cloudflared tunnel create autoagents-api

# Configure tunnel
cloudflared tunnel route dns autoagents-api api-ditech.auto-agents.org
```

**3.4. Create config file `cloudflare-tunnel.yml`:**
```yaml
tunnel: <YOUR-TUNNEL-ID>
credentials-file: C:\Users\Admin\.cloudflared\<TUNNEL-ID>.json

ingress:
  # Route to local API server
  - hostname: api-ditech.auto-agents.org
    service: http://localhost:4000
    
  # Catch-all rule (required)
  - service: http_status:404
```

**3.5. Start tunnel:**
```bash
cloudflared tunnel run autoagents-api
```

**3.6. Auto-start on boot (Optional):**
```bash
# Windows Service
cloudflared service install

# Start service
cloudflared service start
```

### Step 4: Update Cloud Server CORS

**Update `cloud-api-server/.env`:**
```env
# Allow requests from any origin (for desktop apps)
ALLOWED_ORIGINS=*

# Or specific domains
ALLOWED_ORIGINS=http://localhost:3000,https://api-ditech.auto-agents.org
```

**Update `server.js`:**
```javascript
const cors = require('cors');

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS === '*' 
    ? '*' 
    : process.env.ALLOWED_ORIGINS.split(','),
  credentials: true
}));
```

### Step 5: Build Desktop App với Remote API

**Option A: Build time configuration:**
```bash
# Build with production API
VITE_API_URL=https://api-ditech.auto-agents.org npm run build:electron
```

**Option B: Runtime configuration (Better):**

Add settings UI in app để user có thể chọn:
```tsx
// src/components/Settings.tsx
const Settings = () => {
  const [apiUrl, setApiUrl] = useState(
    localStorage.getItem('apiUrl') || 'http://localhost:4000'
  );
  
  return (
    <div>
      <h3>API Server</h3>
      <select onChange={(e) => setApiUrl(e.target.value)}>
        <option value="http://localhost:4000">Local (localhost:4000)</option>
        <option value="https://api-ditech.auto-agents.org">Cloud (Remote)</option>
      </select>
      <button onClick={() => localStorage.setItem('apiUrl', apiUrl)}>
        Save
      </button>
    </div>
  );
};
```

---

## Testing Checklist

### ✅ Local Development
- [ ] Dev server runs on localhost:3000
- [ ] API calls to localhost:4000
- [ ] All features work

### ✅ Remote API (Same Machine)
- [ ] Cloudflare tunnel active
- [ ] api-ditech.auto-agents.org resolves
- [ ] HTTPS working
- [ ] API calls successful

### ✅ Remote Desktop App (Different Machine)
- [ ] Download .exe on different machine
- [ ] Configure API URL to remote
- [ ] All features work
- [ ] No CORS errors
- [ ] Photoshop features disabled (local only)

---

## Limitations & Solutions

### ❌ Photoshop Mode
**Problem:** Desktop app chỉ check LOCAL Photoshop, không check server Photoshop
**Current Behavior:**
- Desktop app → Check `C:\Program Files\Adobe\Photoshop.exe`
- Nếu có → Enable Photoshop Mode (dùng local Photoshop)
- Nếu không → Chỉ có Fast Mode

**With Remote API:**
- Desktop app trên máy A (không có Photoshop)
- Cloud API trên máy B (có Photoshop)
- ❌ Photoshop Mode sẽ disabled vì app không tìm thấy local Photoshop

**Solution:**
1. **Fast Mode** - Luôn work (client-side, không cần Photoshop)
2. **Photoshop Mode** - Chỉ work nếu:
   - Desktop app và Photoshop trên cùng máy, HOẶC
   - Implement thêm: Check server Photoshop và upload qua API

**Workaround hiện tại:**
- Dùng Fast Mode cho remote
- Hoặc cài Photoshop trên máy client

### ❌ File Upload Size
**Problem:** Large PSD files over internet
**Solution:**
- Add compression before upload
- Show upload progress
- Set timeout appropriately

### ❌ Latency
**Problem:** Remote API slower than local
**Solution:**
- Show loading states clearly
- Add timeout handling
- Cache results when possible

---

## Recommended Architecture

```typescript
// src/services/apiClient.ts
class APIClient {
  private baseURL: string;
  private isLocal: boolean;
  
  constructor() {
    this.baseURL = this.detectAPIUrl();
    this.isLocal = this.baseURL.includes('localhost');
  }
  
  detectAPIUrl() {
    // Priority:
    // 1. User setting from localStorage
    // 2. Environment variable
    // 3. Auto-detect (try remote first, fallback to local)
    
    const userSetting = localStorage.getItem('apiUrl');
    if (userSetting) return userSetting;
    
    return import.meta.env.VITE_API_URL || 'http://localhost:4000';
  }
  
  async checkConnection() {
    try {
      await fetch(`${this.baseURL}/health`);
      return true;
    } catch {
      return false;
    }
  }
  
  // Features availability based on connection
  get features() {
    return {
      mockup: true,
      redesign: true,
      clone: true,
      photoshop: this.isLocal, // Only on local
      chat: true
    };
  }
}

export const apiClient = new APIClient();
```

---

## Quick Start Commands

```bash
# 1. Setup tunnel (one-time)
cloudflared tunnel create autoagents-api
cloudflared tunnel route dns autoagents-api api-ditech.auto-agents.org

# 2. Start tunnel
cloudflared tunnel run autoagents-api

# 3. Start cloud server
cd C:\App\autoagents-cloud\cloud-api-server
node server.js

# 4. Build desktop app with remote API
cd C:\App\autoagents-app
VITE_API_URL=https://api-ditech.auto-agents.org npm run build:electron

# 5. Test on different machine
# Copy AutoAgents-Agent-1.0.0-portable.exe to other machine and run
```

---

## Final Answer

**CÓ, desktop app sẽ hoạt động trên máy khác nếu:**

1. ✅ Cloudflare tunnel đang chạy
2. ✅ Cloud server đang chạy  
3. ✅ App được config với remote API URL
4. ✅ CORS được config đúng
5. ⚠️ Photoshop mode sẽ không work (chỉ work trên server machine)

**Bạn muốn tôi implement remote API support không?**
