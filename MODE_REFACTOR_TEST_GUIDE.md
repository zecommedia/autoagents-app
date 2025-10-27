# Mode Refactoring & Testing Guide

## ✅ Refactoring Complete

All modes have been refactored to use **cloudApiService** for AI operations:

### 1. **Redesign Mode (Edit Mode)** ✅
- **Status**: Already integrated via `geminiService.ts` wrapper
- **Cloud API Used**: 
  - `cloudApiService.redesign()` - Image editing, inpainting, outpainting
  - `cloudApiService.multiImageRedesign()` - Multi-image composition
- **AI Models**: Gemini 2.5 Flash Image, GPT Image 1
- **Features**:
  - AI Eraser (remove objects)
  - Brush Tool + Inpainting (edit specific areas)
  - Manual Redesign (transform entire image)
  - AI Redesign Suggestions

### 2. **Video Mode** ✅
- **Status**: Already integrated via `geminiService.ts`
- **Cloud API Used**: `cloudApiService.generateVideo()`
- **AI Model**: Veo 3
- **Features**:
  - Text-to-Video from static image
  - Video suggestions
  - Aspect ratio control (16:9, 9:16, 1:1)

### 3. **Canvas Mode** ✅
- **Status**: Already integrated via `geminiService.ts`
- **Cloud API Used**:
  - `cloudApiService.redesign()` - For composition tasks
  - `cloudApiService.textToImage()` - For text-only generation
- **AI Models**: Gemini 2.5 Flash Image, Imagen 4
- **Features**:
  - Multi-layer composition
  - Text-to-Image generation
  - Image + Drawing composition
  - Generative crop/outpainting

### 4. **Clone Mode** ✅
- **Status**: **JUST REFACTORED** ✨
- **Changes Made**:
  - ❌ Removed: `replicateService.upscaleImage()`
  - ✅ Added: `upscaleImageViaCloud()` using `cloudApiService.upscale()`
- **Cloud API Used**:
  - `cloudApiService.redesign()` - Pattern extraction from original image
  - `cloudApiService.upscale()` - Upscale to 2x resolution
- **AI Models**: Gemini 2.5 Flash Image (pattern), Cloud Upscale API
- **Features**:
  - Upload design image
  - AI extracts pattern with magenta chroma background
  - Auto-detect and crop pattern boundaries
  - Upscale 2x via cloud API
  - Advanced mask tuning (chroma tolerance, morphology, edge refinement)
  - Export as PNG or TIFF-CMYK

---

## 🧪 Testing Checklist

### Prerequisites
1. ✅ Cloud API server running on `localhost:4000`
2. ✅ Valid license key configured
3. ✅ Frontend dev server running

### Test 1: Redesign Mode (Edit Mode)
```
1. Switch to "Redesign" mode in header
2. Upload an image (e.g., product photo, portrait)
3. Test AI Eraser:
   - Select AI Eraser tool
   - Draw over unwanted object
   - Click "Generate" → Object should be removed
4. Test Inpainting:
   - Select Brush tool
   - Draw mask on area to edit
   - Enter prompt (e.g., "change to blue color")
   - Click "Generate" → Area should be edited
5. Test Manual Redesign:
   - Enter redesign prompt (e.g., "make it cyberpunk style")
   - Click "Redesign" → Should generate variations
6. Test AI Suggestions:
   - Click "Get Suggestions" button
   - Select a suggestion → Should apply redesign

✅ Expected: All operations work without errors
✅ Expected: Images returned from cloud API
```

### Test 2: Video Mode
```
1. Switch to "Video" mode in header
2. Upload a static image (e.g., landscape, portrait)
3. Enter video prompt (e.g., "camera pans slowly to the right")
4. Select aspect ratio (16:9, 9:16, or 1:1)
5. Click "Generate Video"
6. Wait for video generation (may take 1-2 minutes)

✅ Expected: Video player appears with generated video
✅ Expected: Video has motion matching the prompt
✅ Expected: No errors in console
```

### Test 3: Canvas Mode
```
1. Switch to "Canvas" mode in header
2. Test Text-to-Image:
   - Enter prompt in text box (e.g., "a cute cat illustration")
   - Click "Generate"
   - Should create image on canvas
3. Test Multi-Image Composition:
   - Upload 2+ images to canvas
   - Add some drawings with brush tool
   - Click "Generate"
   - Should compose all elements into one image
4. Test Generative Crop:
   - Upload an image
   - Select Crop tool
   - Expand crop beyond image boundaries
   - Click "Apply Generative Crop"
   - Should fill extended area with AI-generated content

✅ Expected: All generation modes work
✅ Expected: Images appear on canvas
```

### Test 4: Clone Mode ⭐ (NEWLY REFACTORED)
```
1. Switch to "Clone" mode in header
2. Upload a design image with a clear pattern (e.g., t-shirt graphic, sticker design)
3. Wait for AI processing:
   - Step 1: Cloning (AI extracts pattern with magenta background)
   - Step 2: Detecting (Auto-crop pattern boundaries)
   - Step 3: Upscaling (2x via cloudApiService) ⭐ NEW
   - Step 4: Resizing (Final cutout processing)
4. Review final result:
   - Should show transparent PNG with clean edges
   - No magenta background
   - High resolution (2x original)
5. Test Advanced Tuning (optional):
   - Adjust "Chroma Tolerance" slider
   - Toggle "Edge Smoothing"
   - Click "Reprocess" → Should update mask
6. Test Export:
   - Click "Download PNG"
   - Or click "Download TIFF-CMYK" for print

✅ Expected: Upscale works via cloud API (no Replicate errors)
✅ Expected: Final image has transparent background
✅ Expected: High quality, clean edges
✅ Expected: No localhost:5000 errors in console
```

---

## 🚨 Common Issues & Solutions

### Issue 1: "Not authenticated" error
**Solution**: 
- Check if cloud API server is running: `http://localhost:4000/health`
- Verify license key in Login screen
- Check browser console for auth errors

### Issue 2: "Request timeout" error
**Solution**:
- AI operations take time (especially video & upscale)
- Video generation: 60-120 seconds
- Upscale: 30-60 seconds
- Check cloud API server logs for progress

### Issue 3: Clone Mode shows "upscaleImage is not defined"
**Solution**:
- ✅ Already fixed in refactor
- Uses `upscaleImageViaCloud()` → `cloudApiService.upscale()`

### Issue 4: Canvas/Redesign generates blank images
**Solution**:
- Check prompt quality (be specific)
- Try different AI model (switch Gemini ↔ OpenAI in settings)
- Check cloud API server has valid API keys (.env)

---

## 📊 Testing Results Template

Copy this template to record test results:

```
## Test Results - [Date]

### Redesign Mode
- [ ] AI Eraser: ✅ Pass / ❌ Fail
- [ ] Inpainting: ✅ Pass / ❌ Fail
- [ ] Manual Redesign: ✅ Pass / ❌ Fail
- [ ] AI Suggestions: ✅ Pass / ❌ Fail
- Notes: ___________

### Video Mode
- [ ] Video Generation: ✅ Pass / ❌ Fail
- [ ] Aspect Ratio: ✅ Pass / ❌ Fail
- Notes: ___________

### Canvas Mode
- [ ] Text-to-Image: ✅ Pass / ❌ Fail
- [ ] Multi-Image Composition: ✅ Pass / ❌ Fail
- [ ] Generative Crop: ✅ Pass / ❌ Fail
- Notes: ___________

### Clone Mode (Refactored)
- [ ] Pattern Extraction: ✅ Pass / ❌ Fail
- [ ] Cloud Upscale (2x): ✅ Pass / ❌ Fail ⭐
- [ ] Transparent Background: ✅ Pass / ❌ Fail
- [ ] Advanced Tuning: ✅ Pass / ❌ Fail
- Notes: ___________
```

---

## 🎯 Next Steps

1. **Start Testing**: Run through each test case above
2. **Report Issues**: Log any errors in console
3. **Performance Check**: Note response times for each operation
4. **UI/UX Review**: Check loading states, error messages
5. **Production Readiness**: Verify all modes work reliably

---

## 📝 Code Changes Summary

### Modified Files:
1. **`src/components/CloneMode.tsx`**
   - Changed import from `replicateService` to `cloudApiService`
   - Added `upscaleImageViaCloud()` helper function
   - Replaced `upscaleImage(croppedImageUrl, selectedUpscaleModel)` 
   - With `upscaleImageViaCloud(croppedImageUrl, 2)`

2. **`src/services/geminiService.ts`** (Already done)
   - Wrapper functions for cloudApiService
   - `generateImageFromParts()` → `cloudApiService.redesign()`
   - `generateImagesFromPrompt()` → `cloudApiService.textToImage()`
   - `generateVideoFromImageAndPrompt()` → `cloudApiService.generateVideo()`

3. **`lib/services/cloudApiService.ts`** (Already done)
   - Main API client with authentication
   - Methods: `redesign()`, `textToImage()`, `generateVideo()`, `upscale()`, `chat()`

### Backup Files Created:
- Original MockupMode: `src/components/MockupMode.original.tsx` (if exists)
- Original CloneMode: Can restore from git if needed

---

**Status**: ✅ All refactoring complete. Ready for testing!
