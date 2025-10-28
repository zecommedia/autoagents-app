# 📝 Làm Rõ: Photoshop Mode vs Fast Mode

## Câu Hỏi: Photoshop có liên quan gì đến localhost:4000?

**Trả lời: CÓ và KHÔNG - Tùy mode!**

---

## 🎨 2 Modes Xử Lý Mockup

### Mode 1: **Fast Mode (Client-side)** ⚡
```
Desktop App
    ↓
Client-side processing (ag-psd library)
    ↓
Result
```

**Đặc điểm:**
- ❌ KHÔNG cần Photoshop
- ❌ KHÔNG cần Cloud API
- ✅ Chạy hoàn toàn offline
- ✅ Nhanh (1-2 giây)
- ⚠️ Chất lượng thấp hơn (chỉ overlay lên layer)

**Code:**
```typescript
// lib/psdProcessor.ts
export async function processPsdsClientSide(
  podDesignFile: File, 
  psdFiles: File[]
) {
  // Đọc PSD với ag-psd
  const psd = readPsd(buffer);
  
  // Tìm Smart Object layer
  // Thay thế với POD design
  // Export PNG
  
  return processedImages;
}
```

---

### Mode 2: **Photoshop Mode (Server-side)** 🎨

#### A. Desktop App với Local Photoshop:
```
Desktop App (Electron)
    ↓
Local Photoshop.exe
    ↓
Replace Smart Object via JSX script
    ↓
Export PNG
    ↓
Return to App
```

**Đặc điểm:**
- ✅ Cần Photoshop cài trên **cùng máy với Desktop App**
- ❌ KHÔNG cần Cloud API (localhost:4000)
- ❌ KHÔNG cần Internet
- ✅ Chất lượng cao (Photoshop render thật)
- ⚠️ Chậm hơn (5-10 giây/file)

**Code:**
```javascript
// electron/main.js
ipcMain.handle('process-mockups-photoshop', async (event, data) => {
  // 1. Copy files to temp folder
  // 2. Run Photoshop.exe with JSX script
  await execAsync(`"${photoshopPath}" -r "${scriptPath}"`);
  // 3. Wait for Photoshop to process
  // 4. Return result
});
```

#### B. Web App với Remote Photoshop:
```
Web Browser
    ↓
HTTP POST to localhost:4000 (Cloud API)
    ↓
Cloud Server runs Photoshop.exe
    ↓
Replace Smart Object
    ↓
Export PNG
    ↓
Return to Browser
```

**Đặc điểm:**
- ✅ Cần Photoshop cài trên **máy chủ Cloud API**
- ✅ CÓ dùng Cloud API (localhost:4000)
- ✅ Chất lượng cao
- ⚠️ Cần upload file lên server (chậm nếu file lớn)

**Code:**
```typescript
// src/services/cloudApiService.ts
const response = await fetch('http://localhost:4000/api/mockup/process-mockups-photoshop', {
  method: 'POST',
  body: formData
});
```

---

## 📊 So Sánh Chi Tiết

| Feature | Fast Mode | Desktop + Local PS | Web + Remote PS |
|---------|-----------|-------------------|-----------------|
| **Cần Photoshop?** | ❌ Không | ✅ Trên máy Desktop | ✅ Trên máy Server |
| **Cần Cloud API?** | ❌ Không | ❌ Không | ✅ Có (port 4000) |
| **Cần Internet?** | ❌ Không | ❌ Không | ✅ Có (nếu remote) |
| **Tốc độ** | ⚡ Rất nhanh (1-2s) | 🐢 Chậm (5-10s) | 🐢🐢 Rất chậm (10-30s) |
| **Chất lượng** | ⭐⭐ Thấp | ⭐⭐⭐⭐⭐ Cao | ⭐⭐⭐⭐⭐ Cao |
| **Offline** | ✅ | ✅ | ❌ |

---

## 🎯 Khi Nào Dùng Mode Nào?

### Use Fast Mode khi:
- ✅ Không có Photoshop
- ✅ Cần nhanh
- ✅ Chấp nhận chất lượng thấp hơn
- ✅ Làm việc offline

### Use Desktop + Local Photoshop khi:
- ✅ Có Photoshop trên máy
- ✅ Cần chất lượng cao
- ✅ Làm việc offline
- ✅ Không muốn upload file lên server

### Use Web + Remote Photoshop khi:
- ✅ Không có Photoshop trên máy
- ✅ Có server với Photoshop
- ✅ Chấp nhận upload file
- ✅ Nhiều người dùng chung server

---

## 🔧 Kết Luận về Task 5

### Khi dùng Remote API (api-ditech.auto-agents.org):

**✅ WORK:**
- Redesign Mode (Cloud AI)
- Clone Mode (Cloud AI)
- Chat Mode (Cloud AI)
- Video Mode (Cloud AI)
- Mockup Mode - **Fast Mode** (Client-side)

**❌ KHÔNG WORK:**
- Mockup Mode - **Photoshop Mode** (Cần Photoshop local)

### Lý do:
Desktop app trên máy A không thể điều khiển Photoshop trên máy B (server) **trực tiếp**. 

Để Photoshop Mode work với Remote API, cần:
1. Cloud API server phải có Photoshop cài đặt
2. Desktop app gửi files qua HTTP POST đến Cloud API
3. Cloud API chạy Photoshop và trả về kết quả

**Hiện tại:** Desktop app chỉ check Photoshop **local**, không check Photoshop trên server.

---

## 🛠️ Fix để Support Remote Photoshop

Nếu muốn Desktop app work với Remote Photoshop:

```typescript
// src/components/MockupMode.tsx
React.useEffect(() => {
  const checkPhotoshop = async () => {
    if (isElectron && window.electron) {
      // Desktop app - check LOCAL Photoshop
      const result = await window.electron.checkPhotoshop();
      setPhotoshopAvailable(result.installed);
    } else {
      // Web app - check SERVER Photoshop
      const response = await fetch(`${apiClient.getBaseURL()}/api/mockup/check-photoshop`);
      const result = await response.json();
      setPhotoshopAvailable(result.installed);
    }
    
    // 🆕 NEW: Also check if remote has Photoshop
    if (apiClient.getMode() === 'remote') {
      try {
        const response = await fetch(`${apiClient.getBaseURL()}/api/mockup/check-photoshop`);
        const result = await response.json();
        setRemotePhotoshopAvailable(result.installed);
      } catch (e) {
        setRemotePhotoshopAvailable(false);
      }
    }
  };
  checkPhotoshop();
}, []);
```

Bạn có muốn tôi implement thêm phần này không? 🤔
