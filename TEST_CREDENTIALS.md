# 🔑 Test Credentials

## License Keys

### Free Tier (Testing)
```
License: TEST-FREE-KEY-87654321
Email: test@example.com
Tier: Free
Limit: 10 operations
```

### Enterprise Tier (Admin)
```
License: ADMIN-TEST-KEY-12345678
Email: admin@zecom.vn
Tier: Enterprise
Limit: Unlimited (999,999)
```

---

## API Endpoints

### Cloud API Server
```
Local: http://localhost:4000
Production: https://api-ditech.auto-agents.org
```

### Download Portal
```
Local: http://localhost:3002
```

---

## Quick Test Commands

### Test Free License
```powershell
Invoke-RestMethod -Uri http://localhost:4000/auth/verify `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"licenseKey":"TEST-FREE-KEY-87654321","machineId":"test"}'
```

### Test Admin License
```powershell
Invoke-RestMethod -Uri http://localhost:4000/auth/verify `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"licenseKey":"ADMIN-TEST-KEY-12345678","machineId":"test"}'
```

### Check Server Health
```powershell
Invoke-RestMethod http://localhost:4000/health
```

---

## Database Info

### Supabase Connection
```
Host: db.dzxfuljczidahgbaquyj.supabase.co
Port: 5432
Database: postgres
```

### Tables
- `users` - License holders and user info
- `operations` - AI operation logs
- `telemetry` - Analytics events
- `api_keys` - Integration keys

---

## Feature Costs (Credits)

| Feature | Cost | Type |
|---------|------|------|
| Remove Background | 0 | Local |
| Edge Detection | 0 | Local |
| Crop/Resize | 0 | Local |
| AI Redesign | 1 | Cloud |
| AI Clone | 1 | Cloud |
| Upscale | 2 | Cloud |
| Video Generation | 5 | Cloud |

---

## Testing Workflow

### 1. Start Services
```powershell
# Terminal 1: Cloud API
cd c:\autoagents-cloud\cloud-api-server
npm start

# Terminal 2: Download Portal
cd c:\autoagents-cloud\download-portal
node server.js

# Terminal 3: Desktop App (Dev)
cd c:\autoagents-app
npx electron .
```

### 2. Test Login
1. Open desktop app
2. Enter: `TEST-FREE-KEY-87654321`
3. Click "Activate License"
4. Should see main editor

### 3. Test Features
- Upload image
- Try local features (free, instant)
- Try cloud features (1-5 credits each)
- Check usage counter in header

### 4. Test Limits
- Use all 10 operations (free tier)
- Next operation should fail
- Switch to admin license (unlimited)

---

Generated: October 26, 2025
