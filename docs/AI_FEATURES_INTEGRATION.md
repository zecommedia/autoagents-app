# 🔧 AI Features Integration Guide

## Problem Statement

Currently, the desktop app uses **direct API calls** to Gemini and OpenAI:
- ✅ **Gemini Chat** works (text-only)
- ❌ **Gemini Image Edit** fails (needs cloud proxy)
- ❌ **OpenAI** fails (no API key or quota)

**Root Cause**: `App.tsx` imports `geminiService` and `openAIChatService` directly instead of using `cloudApiService`.

---

## Solution: Wire Cloud API Service

### Step 1: Import cloudApiService in App.tsx

```typescript
// Add this import at the top of src/App.tsx
import { cloudApiService } from '../lib/services/cloudApiService';
```

### Step 2: Replace Direct API Calls

#### Current Code (❌ Direct):
```typescript
import { generateImageFromParts } from './services/geminiService';

// In handleRedesign:
const result = await generateImageFromParts(parts, prompt);
```

#### New Code (✅ Via Cloud API):
```typescript
import { cloudApiService } from '../lib/services/cloudApiService';

// In handleRedesign:
const result = await cloudApiService.redesign({
  image: baseImageDataUrl,
  prompt: redesignPrompt,
  mode: 'redesign'
});
```

---

## Detailed Changes Needed

### 1. Update handleRedesign Function

**Location**: `src/App.tsx` line ~1200

**Before**:
```typescript
const handleRedesign = async () => {
  // ... existing code ...
  
  const result = await generateImageFromParts(
    [dataUrlToPart(baseImage), { text: prompt }],
    `Generate redesigned image based on: ${prompt}`
  );
  
  // ... rest of code ...
};
```

**After**:
```typescript
const handleRedesign = async () => {
  // ... existing code ...
  
  try {
    const result = await cloudApiService.redesign({
      image: baseImage, // base64 data URL
      prompt: prompt,
      mode: 'redesign'
    });
    
    setGeneratedImages([result.result]);
    setUsageInfo({
      credits: result.usage || 0,
      cost: result.cost || 1
    });
  } catch (error) {
    console.error('Redesign failed:', error);
    setError(error.message || 'Failed to generate redesign');
  }
  
  // ... rest of code ...
};
```

### 2. Update Clone Mode

**Location**: `src/components/CloneMode.tsx`

**Before**:
```typescript
const result = await generateImageFromParts([
  dataUrlToPart(referenceImage),
  dataUrlToPart(targetImage),
  { text: 'Extract pattern and apply to target' }
]);
```

**After**:
```typescript
const result = await cloudApiService.clone({
  referenceImage: referenceImage,
  targetImage: targetImage,
  prompt: 'Extract pattern and apply to target'
});
```

### 3. Update Chat Panel (if using AI chat)

**Location**: `src/components/ChatPanel.tsx`

**Option A**: Keep Gemini chat working as-is (text-only)
**Option B**: Use cloud API for consistency (recommended for production)

**For Option B**:
```typescript
// Replace direct Gemini call with:
const response = await cloudApiService.redesign({
  image: currentImageDataUrl,
  prompt: userMessage,
  mode: 'chat'
});
```

---

## Benefits of Using Cloud API

### 1. Centralized Authentication ✅
- Uses JWT token from login
- Tracks usage per user
- Enforces tier limits

### 2. Cost Tracking 💰
- Each operation deducts credits
- Real-time usage updates
- Billing integration ready

### 3. Security 🔒
- API keys hidden on server
- No client-side API key exposure
- Rate limiting enabled

### 4. Unified Error Handling ⚠️
- Consistent error messages
- Retry logic built-in
- Fallback strategies

### 5. Analytics 📊
- Operation logs in database
- Performance metrics
- User behavior tracking

---

## Quick Fix for Testing

### Temporary Solution (5 minutes):

If you want to test AI features NOW without full integration:

1. **Check API Keys in .env**:
   ```bash
   cd c:\autoagents-cloud\cloud-api-server
   cat .env | Select-String "GEMINI_API_KEY"
   ```

2. **Update Gemini Service** to show better errors:
   ```typescript
   // In src/services/geminiService.ts
   throw new Error('Gemini service not available in desktop app. Please use cloudApiService.redesign() instead.');
   ```

3. **Disable OpenAI** temporarily:
   ```typescript
   // In src/App.tsx
   if (provider === 'openai') {
     throw new Error('OpenAI not available. Use Enterprise tier for full features.');
   }
   ```

---

## Full Integration Steps (Phase 3)

### Priority Tasks:

1. ✅ **Login with cloudAuthService** - DONE
2. ✅ **Local features** (remove BG, edge detection) - DONE
3. 🔄 **Wire cloudApiService** - IN PROGRESS
4. ⏳ **Display usage/credits in Header**
5. ⏳ **Handle tier limits**
6. ⏳ **Error handling & retries**

### Files to Modify:

1. `src/App.tsx` - Main app logic
2. `src/components/CloneMode.tsx` - Clone feature
3. `src/components/Header.tsx` - Display usage
4. `src/components/Toolbar.tsx` - Add local feature buttons
5. `src/services/geminiService.ts` - Add deprecation warning

---

## Testing Checklist

### After Integration:

- [ ] Login with test license key
- [ ] Upload image
- [ ] Try Redesign (should use cloud API)
- [ ] Check usage counter decrements
- [ ] Try Clone Mode (should use cloud API)
- [ ] Try Upscale (should use cloud API)
- [ ] Exhaust free tier credits (10)
- [ ] Next operation should show "Insufficient credits"
- [ ] Switch to admin license (unlimited)
- [ ] All operations should work

---

## Error Messages to Handle

### 1. Network Errors
```typescript
if (!navigator.onLine) {
  throw new Error('No internet connection. Cloud features require internet.');
}
```

### 2. Quota Exceeded
```typescript
if (error.response?.status === 429) {
  throw new Error('Usage limit reached. Upgrade tier for more credits.');
}
```

### 3. Invalid Token
```typescript
if (error.response?.status === 401) {
  // Auto re-auth
  await cloudAuthService.verifyLicense(savedLicenseKey);
  // Retry operation
}
```

---

## Next Steps

### Immediate (Do Now):
1. Copy latest .exe to download portal ✅ DONE
2. Update versions.json ✅ DONE
3. Rebuild download portal ✅ DONE
4. Test download from http://localhost:3002

### Short Term (This Session):
1. Add cloudApiService import to App.tsx
2. Replace handleRedesign with cloudApiService.redesign()
3. Test redesign with enterprise license
4. Verify usage tracking works

### Long Term (Next Session):
1. Full UI integration (all features)
2. Usage display in Header
3. Local feature buttons in Toolbar
4. Complete error handling
5. Production build without DevTools

---

Generated: October 26, 2025, 9:15 PM
