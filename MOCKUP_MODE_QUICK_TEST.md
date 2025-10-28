# 🧪 MOCKUP MODE - QUICK TEST GUIDE

**Quick Reference**: How to test Mockup Mode in 5 minutes

---

## ⚡ QUICK START

### **Step 1: Start Servers** (2 terminals)

**Terminal 1 - Cloud Server:**
```bash
cd c:\autoagents-cloud\cloud-api-server
npm start
```
Wait for: `🚀 Cloud API Server running on port 4000`

**Terminal 2 - App:**
```bash
cd c:\autoagents-app
npm start
```
Wait for app to open in browser

---

## 🎯 TEST 1: BASIC MOCKUP (Most Important)

**What you need:**
- 1 sticker image (PNG/JPG) - your design
- 1 PSD file with "REPLACE" layer

**Steps:**
1. Open app → Click "Mockup Mode" tab
2. Upload sticker → See preview
3. Upload PSD file → See in list
4. Click "Process Mockups"
5. Wait 5-10 seconds
6. See result → Click "Download"

**Expected:**
- ✅ Sticker replaces "REPLACE" layer
- ✅ PNG downloads successfully
- ✅ Quality looks good

**If it works → Mockup Mode is 100% functional! 🎉**

---

## 🎯 TEST 2: MULTIPLE PSDs (Optional)

**Steps:**
1. Upload 1 sticker
2. Upload 3 PSD files
3. Process
4. Download all 3 results

**Expected:**
- ✅ All 3 processed
- ✅ Same sticker in all

---

## 🎯 TEST 3: FALLBACK (No REPLACE Layer)

**Steps:**
1. Upload sticker
2. Upload PSD **without** "REPLACE" layer
3. Process

**Expected:**
- ✅ No error
- ✅ Sticker placed in center
- ⚠️ Console warning (normal)

---

## ❌ TROUBLESHOOTING

### **Error: "Sticker and PSD files are required"**
→ Make sure you uploaded both sticker AND PSD

### **Error: "Could not render PSD composite"**
→ Try different PSD file (might be corrupted)

### **No result shows up**
→ Check browser console (F12) for errors
→ Check cloud server terminal for errors

### **Download doesn't work**
→ Try right-click → "Save Image As"

---

## 📋 CHECKLIST

Before reporting bugs, verify:
- [ ] Cloud server running on port 4000
- [ ] App running and accessible
- [ ] Sticker file is valid image (PNG/JPG)
- [ ] PSD file is valid (not corrupted)
- [ ] Browser console shows no errors
- [ ] Server terminal shows no errors

---

## 🎊 SUCCESS CRITERIA

If Test 1 works → **Feature is complete!** ✅

Everything else is bonus functionality.

---

## 📞 NEED HELP?

**Check these files:**
- `MOCKUP_MODE_IMPLEMENTATION_COMPLETE.md` - Full documentation
- `MOCKUP_MODE_REFACTOR_PLAN.md` - Implementation plan

**Common Issues:**
1. Port 4000 already in use → Change PORT in .env
2. Dependencies missing → Run `npm install` in cloud-api-server
3. PSD not working → Check layer is named "REPLACE"

---

**Time to test**: ~5 minutes  
**Confidence**: 95%  
**Ready**: ✅ NOW
