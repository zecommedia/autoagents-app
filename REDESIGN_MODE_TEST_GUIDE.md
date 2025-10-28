# 🧪 QUICK TEST GUIDE - REDESIGN MODE

## 🚀 BẮT ĐẦU TEST

### **Bước 1: Khởi động Backend** (Terminal 1)
```powershell
cd c:\autoagents-cloud\cloud-api-server
npm start
```
✅ Đợi thông báo: `Server running on port 4000`

### **Bước 2: Khởi động Frontend** (Terminal 2)
```powershell
cd c:\autoagents-app
npm run dev
```
✅ Đợi thông báo: `Local: http://localhost:5173`

---

## 📋 TEST CASE: MANUAL REDESIGN (Priority 1)

### **Test Flow:**
1. Mở browser: `http://localhost:5173`
2. Login (nếu chưa)
3. Click **"Redesign"** mode ở header
4. Upload một ảnh (drag & drop hoặc paste)
5. Đợi AI suggestions tự động load (3-4 giây)
6. **Option A**: Click một suggestion chip
7. **Option B**: Nhập manual prompt vào input box dưới:
   - Ví dụ: `"make it cyberpunk style"`
8. Chọn số lượng ảnh muốn generate (click số "4")
9. Click nút **"Redesign"** (màu gradient xanh)
10. Đợi loading... (có thể 30-60 giây)

### **✅ EXPECTED RESULT:**
- VariationViewer xuất hiện
- Hiện 4 variations khác nhau
- Có arrows left/right để navigate
- Click "Accept" → Base image replaced
- **CRITICAL**: Variations phải KHÁC NHAU, không phải cùng 1 ảnh!

### **❌ IF FAILS:**
1. Mở DevTools Console (F12)
2. Check lỗi màu đỏ
3. Check tab Network → Filter "detailed-redesign"
4. Xem response có data không

---

## 🐛 DEBUGGING

### **Backend Logs:**
```powershell
# Check trong terminal backend, tìm dòng:
POST /proxy/detailed-redesign-prompts (user demo-user-1, concept: "...", count: 4)
Generated 4 detailed redesign prompts
```

### **Frontend Console:**
```javascript
// Tìm trong browser console:
🎨 Detailed prompts result: {success: true, data: Array(4)}
```

### **Test Endpoint Trực Tiếp:**
```powershell
# Test backend endpoint (PowerShell)
$headers = @{
    "Authorization" = "Bearer YOUR_TOKEN_HERE"
}

$body = @{
    concept = "cyberpunk style"
    numberOfIdeas = "4"
    systemPrompt = "Generate 4 detailed prompts..."
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:4000/proxy/detailed-redesign-prompts" `
    -Method POST `
    -Headers $headers `
    -Body $body `
    -ContentType "application/json"

$response.Content
```

---

## 📊 SUCCESS CRITERIA

### ✅ **Phase 2 is SUCCESSFUL if:**
1. Backend endpoint responds (status 200)
2. Returns JSON array with 4 strings
3. Each string is a detailed prompt (not mock like "Variation 1")
4. Frontend receives data
5. VariationViewer shows 4 different images
6. No console errors

### ❌ **Phase 2 FAILED if:**
1. Endpoint returns 500 error
2. Returns mock data like `["Variation 1", "Variation 2"]`
3. Frontend shows error alert
4. Only 1 variation generated instead of 4
5. All 4 variations look identical

---

## 🔧 COMMON FIXES

### **Problem**: `404 Not Found`
**Solution**: Backend chưa restart
```powershell
# Ctrl+C trong terminal backend
npm start
```

### **Problem**: `401 Unauthorized`
**Solution**: Login lại ở frontend

### **Problem**: Mock data returned
**Solution**: Check `geminiService.ts` line ~270, verify not using fallback

### **Problem**: Timeout
**Solution**: Increase timeout trong `cloudApiService.ts`:
```typescript
timeout: 180000, // 3 minutes instead of 2
```

---

## 🎯 QUICK VALIDATION

### **1-Minute Smoke Test:**
```
1. Redesign mode
2. Upload image
3. Click suggestion chip
4. Wait for variations
5. Check if 4 different images appear
```
✅ Pass → Continue to Phase 3  
❌ Fail → Check logs & debug

---

## 📞 NEXT STEPS AFTER TESTING

### **If Test PASSES:**
- [ ] Mark Phase 2 as COMPLETE in progress tracker
- [ ] Move to Phase 3: UI Components Verification
- [ ] Test Inpainting flow
- [ ] Test AI Eraser

### **If Test FAILS:**
- [ ] Copy error from console
- [ ] Check backend logs
- [ ] Verify endpoint code
- [ ] Re-test after fix

---

**🎉 Good luck testing!**
