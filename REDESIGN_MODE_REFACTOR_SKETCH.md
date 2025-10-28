# 📋 EDIT (REDESIGN) MODE - REFACTOR SKETCH CHI TIẾT

## 🎯 OVERVIEW

**Mục tiêu**: Clone y hệt Edit (Redesign) Mode từ `AutoAgents-Redesign` vào `autoagents-app`, đảm bảo tất cả tính năng, công cụ, và trải nghiệm người dùng giống hệt nhau.

---

## 🏗️ KIẾN TRÚC HIỆN TẠI

### AutoAgents-Redesign (Source)
```
App.tsx
├── appMode: 'edit' (Redesign Mode)
├── editHistory: History (separate từ canvas & video)
├── imageForEdit: ImageObject | undefined
├── redesignSuggestions: RedesignConcept[]
└── Tools: brush, eraser, ai_eraser, crop, image

services/geminiService.ts
├── generateImageFromParts() → Gemini API trực tiếp
├── generateRedesignConcepts() → Gemini 2.5 Flash
└── generateDetailedRedesignPrompts() → Gemini 2.5 Flash

components/
├── Canvas.tsx (canvasMode='edit')
├── Toolbar.tsx (Edit mode specific UI)
└── MaskPromptPopup (inpainting dialog)

prompts.ts
├── getRedesignPrompt()
├── getRedesignConceptsPrompt()
├── getDetailedRedesignPrompts()
├── getInpaintingPrompt()
├── getAIEraserPrompt()
└── editModeBasePrompt
```

### autoagents-app (Target)
```
src/App.tsx
├── appMode: 'edit' ✅ ĐÃ CÓ
├── editHistory: History ✅ ĐÃ CÓ
├── imageForEdit: ImageObject | undefined ✅ ĐÃ CÓ
└── redesignSuggestions: RedesignConcept[] ✅ ĐÃ CÓ

src/services/geminiService.ts
├── generateImageFromParts() → cloudApiService.redesign()
├── generateRedesignConcepts() → cloudApiService.redesignSuggestions()
└── generateDetailedRedesignPrompts() → Mock (cần implement)

src/components/
├── Canvas.tsx (canvasMode='edit') ✅ ĐÃ CÓ
├── Toolbar.tsx (Edit mode UI) ✅ ĐÃ CÓ
└── MaskPromptPopup ❌ THIẾU (hiện có, nhưng cần kiểm tra)

src/prompts.ts ❌ THIẾU HOÀN TOÀN
```

---

## 📊 SO SÁNH CHI TIẾT: TÍNH NĂNG CÓ VÀ THIẾU

### ✅ ĐÃ CÓ (Hoạt động đúng)

#### 1. **Core Mode Structure**
- [x] `appMode === 'edit'` routing logic
- [x] Separate `editHistory` from `canvasHistory`
- [x] `imageForEdit` computed property
- [x] Mode switching với header buttons

#### 2. **Tools Available**
- [x] **Brush Tool**: Vẽ mask cho inpainting
- [x] **AI Eraser**: Xóa objects bằng AI
- [x] **Eraser**: Pixel eraser thường
- [x] **Crop Tool**: Resize/expand với generative fill
- [x] **Image Upload**: Drag & drop hoặc paste

#### 3. **AI Suggestions**
- [x] Auto-fetch redesign suggestions khi upload ảnh
- [x] Display suggestions dưới dạng buttons
- [x] Click suggestion → execute redesign

#### 4. **API Integration**
- [x] `cloudApiService.redesign()` cho image editing
- [x] `cloudApiService.redesignSuggestions()` cho AI suggestions
- [x] Error handling với fallback

#### 5. **Canvas Behavior**
- [x] Single image mode (chỉ 1 ảnh base, không multi-layer)
- [x] Background image không thể select/move trong edit mode
- [x] Mask objects vẽ trên ảnh base

---

### ❌ THIẾU HOẶC CẦN REFACTOR

#### 1. **prompts.ts File** ⚠️ **CAO NHẤT**
```typescript
// autoagents-app THIẾU HOÀN TOÀN file prompts.ts
// Cần copy từ AutoAgents-Redesign:

export const getRedesignPrompt = () => {...}
export const getRedesignConceptsPrompt = () => {...}
export const getDetailedRedesignPrompts = (numberOfIdeas: number) => {...}
export const getInpaintingPrompt = (maskedContentDescription: string, userPrompt: string) => {...}
export const getAIEraserPrompt = () => {...}
export const getFixInpaintingPrompt = (userPrompt: string) => {...}
export const editModeBasePrompt = "..."
```

**Vị trí**: `c:\autoagents-app\src\prompts.ts` (file mới)

**Action**: 
- Copy toàn bộ file `prompts.ts` từ AutoAgents-Redesign
- Import vào `src/App.tsx` và `src/services/geminiService.ts`

---

#### 2. **Detailed Redesign Prompts Generation** ⚠️ **CAO**

**AutoAgents-Redesign có:**
```typescript
// services/geminiService.ts
export const generateDetailedRedesignPrompts = async (
    baseImageSrc: string,
    userConcept: string,
    numberOfIdeas: number,
    getPrompt: (count: number) => string
): Promise<string[]> => {
    // Gọi Gemini 2.5 Flash để expand concept thành detailed prompts
    const imagePart = await dataUrlToPart(baseImageSrc);
    const systemPrompt = getPrompt(numberOfIdeas);
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, { text: userConcept }] },
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
    });
    
    return JSON.parse(response.text.trim());
}
```

**autoagents-app hiện tại:**
```typescript
// src/services/geminiService.ts
export async function generateDetailedRedesignPrompts(
  imageDataUrl: string,
  concept: string,
  numImages: number = 3,
  promptTemplate?: string
): Promise<string[]> {
  // ❌ MOCK DATA - Không gọi API thật
  return [
    `Redesign with ${concept} theme, high detail`,
    `Transform using ${concept} style, professional quality`,
    `Apply ${concept} aesthetic, 4K resolution`
  ].slice(0, numImages);
}
```

**Action**: 
- Tạo endpoint mới: `POST /api/proxy/detailed-redesign-prompts`
- Backend gọi Gemini 2.5 Flash với JSON schema
- Frontend update `generateDetailedRedesignPrompts()` gọi cloud API

---

#### 3. **Inpainting Dialog (MaskPromptPopup)** ⚠️ **TRUNG BÌNH**

**AutoAgents-Redesign:**
- Sau khi vẽ mask bằng Brush, dialog xuất hiện
- User nhập prompt mô tả thay đổi
- Có thể drop image vào dialog để combine
- 2 modes: Simple inpainting & Fix inpainting

**autoagents-app:**
- File `MaskPromptPopup` có vẻ đã có
- Cần kiểm tra xem có đầy đủ features không:
  - [ ] Text input cho prompt
  - [ ] Image drop zone
  - [ ] "Generate" button
  - [ ] "Cancel" button
  - [ ] Position relative to mask

**Action**:
- Read `src/components/MaskPromptPopup.tsx`
- So sánh với `AutoAgents-Redesign/components/MaskPromptPopup.tsx`
- Bổ sung thiếu sót

---

#### 4. **Variation Viewer** ⚠️ **TRUNG BÌNH**

**AutoAgents-Redesign có:**
```typescript
// App.tsx
const [variations, setVariations] = useState<VariationState>({
    visible: false,
    images: Variation[],
    currentIndex: number,
    originalImageSrc: string,
    targetObjectId: string | null,
});

const handleSelectVariation = (index: number) => {...}
const handleAcceptVariation = () => {...}
const handleCancelVariation = () => {...}
```

**autoagents-app:**
- Có `VariationViewer` component
- Cần check xem có được dùng trong Edit mode không
- Cần check xem có preview left/right navigation không

**Action**:
- Verify `src/components/VariationViewer.tsx` đang được render
- Test flow: Manual Redesign → Generate 4 variations → Browse → Accept

---

#### 5. **Manual Redesign Flow** ⚠️ **CAO**

**Flow hoàn chỉnh trong AutoAgents-Redesign:**
```
1. User upload ảnh → Edit mode
2. AI suggestions tự động xuất hiện
3. User click suggestion HOẶC nhập manual prompt
4. System gọi executeRedesign():
   a. Gọi generateDetailedRedesignPrompts() → Expand concept
   b. For each detailed prompt:
      - Gọi generateImageFromParts() với getRedesignPrompt()
   c. Load all variations
   d. Show VariationViewer
5. User browse variations (left/right arrows)
6. User click "Accept" → Replace base image
```

**autoagents-app hiện tại:**
```typescript
// src/App.tsx
const executeRedesign = async (userConcept: string, numImages: number) => {
    const ideaPrompts = await generateDetailedRedesignPrompts(...);
    // ❌ ideaPrompts là mock data
    
    const imageGenerationPromises = ideaPrompts.map(async (ideaPrompt) => {
        const parts: Part[] = [...];
        const result = await generateImageFromParts(parts, 1);
        // ✅ Phần này đúng
    });
    
    // ✅ Show variations viewer
    setVariations({...});
};
```

**Vấn đề**: `generateDetailedRedesignPrompts()` trả mock data nên kết quả không đúng.

**Action**:
- Fix `generateDetailedRedesignPrompts()` như mục #2
- Test full flow

---

#### 6. **AI Eraser Prompt** ⚠️ **THẤP**

**AutoAgents-Redesign:**
```typescript
export const getAIEraserPrompt = () => {
    return `**Role:** You are an expert visual editor...
    **Instructions:**
    1. Analyze: Image with transparent area
    2. Execute: Reconstruct background
    3. Output: Complete image with transparent filled
    `;
};
```

**autoagents-app:**
- Có logic AI Eraser
- Không rõ có dùng prompt chuyên biệt không

**Action**:
- Import `getAIEraserPrompt()` từ `prompts.ts`
- Update `handleAIEraserGeneration()` để dùng prompt chuẩn

---

#### 7. **Crop Tool với Generative Fill** ⚠️ **TRUNG BÌNH**

**AutoAgents-Redesign:**
- Crop tool trong Edit mode = "Resize" tool
- 2 options:
  - **Standard Crop**: Cắt thông thường
  - **Generative Crop**: Expand canvas + AI fill background

**autoagents-app:**
- Có `handleApplyStandardCrop()` ✅
- Có `handleApplyGenerativeCrop()` ✅
- Cần check prompt cho generative crop

**Action**:
- Read `handleApplyGenerativeCrop()` trong `src/App.tsx`
- Verify dùng prompt đúng (outpainting prompt)

---

#### 8. **Number of Images Picker** ⚠️ **THẤP**

**AutoAgents-Redesign:**
```typescript
// Toolbar.tsx
<NumberOfImagesPicker
  numberOfImages={numberOfImages}
  onNumberOfImagesChange={onNumberOfImagesChange}
  isCompositionTask={isCompositionTask}
  appMode={appMode}
/>
```
- Hiện số lượng ảnh sẽ generate (1, 2, 3, 4)
- Tooltip khác nhau tùy mode

**autoagents-app:**
- Có component này ✅
- Cần verify tooltip text cho Edit mode

---

#### 9. **Debug Popup (Alt+Click)** ⚠️ **THẤP**

**AutoAgents-Redesign:**
- Alt+Click "Generate" → Show debug info
- Display: parts[], fullPrompt, sourceImages[]

**autoagents-app:**
- Có `DebugPopup` component
- Cần check xem có trigger từ Edit mode không

---

#### 10. **Keyboard Shortcuts** ⚠️ **THẤP**

**AutoAgents-Redesign:**
```
V: Select tool
B: Brush
E: Eraser (toggle pixel/AI)
C: Crop
Shift+Enter: Generate
Ctrl+Z: Undo
Ctrl+Shift+Z: Redo
Escape: Cancel crop
```

**autoagents-app:**
- Có keyboard handler ✅
- Cần verify Edit mode không conflict

---

## 🔧 REFACTOR PLAN - STEP BY STEP

### **Phase 1: Core Infrastructure** ⏱️ 2 hours

#### Step 1.1: Create prompts.ts
```bash
# Copy file từ AutoAgents-Redesign
cp "c:\Users\ADMIN\AutoAgents-Redesign\prompts.ts" "c:\autoagents-app\src\prompts.ts"
```
- [ ] Copy file
- [ ] Fix imports (nếu cần)
- [ ] Add to git

#### Step 1.2: Update src/App.tsx imports
```typescript
// Add to top of src/App.tsx
import {
  getRedesignPrompt,
  getRedesignConceptsPrompt,
  getDetailedRedesignPrompts,
  getInpaintingPrompt,
  getAIEraserPrompt,
  editModeBasePrompt
} from './prompts';
```

#### Step 1.3: Update src/services/geminiService.ts
```typescript
// Import prompts
import {
  getRedesignConceptsPrompt,
  getDetailedRedesignPrompts as getDetailedRedesignPromptsTemplate
} from '../prompts';

// Update generateRedesignConcepts()
const prompt = typeof promptTemplate === 'function' 
  ? promptTemplate() 
  : (promptTemplate || getRedesignConceptsPrompt());
```

---

### **Phase 2: Backend API Endpoint** ⏱️ 3 hours

#### Step 2.1: Create detailed-redesign-prompts endpoint
```bash
# File: server/routes/proxy.js (hoặc wherever cloud API routes are)
```

```javascript
router.post('/detailed-redesign-prompts', upload.single('image'), async (req, res) => {
  try {
    const { concept, numberOfIdeas, systemPrompt } = req.body;
    const imageFile = req.file;
    
    if (!imageFile || !concept) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing image or concept' 
      });
    }
    
    // Call Gemini 2.5 Flash
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const imagePart = {
      inlineData: {
        data: imageFile.buffer.toString('base64'),
        mimeType: imageFile.mimetype
      }
    };
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { 
        parts: [imagePart, { text: concept }] 
      },
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
            description: 'Detailed prompt for image generation'
          }
        }
      }
    });
    
    const ideas = JSON.parse(response.text.trim());
    
    res.json({ 
      success: true, 
      data: ideas 
    });
    
  } catch (error) {
    console.error('Detailed redesign prompts error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
```

#### Step 2.2: Update cloudApiService
```typescript
// lib/services/cloudApiService.ts
export const cloudApiService = {
  // ...existing methods...
  
  detailedRedesignPrompts: async (
    imageFile: File, 
    concept: string, 
    numberOfIdeas: number,
    systemPrompt: string
  ): Promise<ApiResponse<string[]>> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('concept', concept);
    formData.append('numberOfIdeas', numberOfIdeas.toString());
    formData.append('systemPrompt', systemPrompt);
    
    const response = await fetch(`${API_BASE_URL}/api/proxy/detailed-redesign-prompts`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authService.getToken()}` },
      body: formData
    });
    
    return response.json();
  }
};
```

#### Step 2.3: Update geminiService.ts
```typescript
// src/services/geminiService.ts
export async function generateDetailedRedesignPrompts(
  imageDataUrl: string,
  concept: string,
  numImages: number = 3,
  promptTemplate?: string | ((n: number) => string)
): Promise<string[]> {
  try {
    // Convert to File
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();
    const file = new File([blob], 'image.png', { type: blob.type });
    
    // Get system prompt
    const systemPrompt = typeof promptTemplate === 'function' 
      ? promptTemplate(numImages)
      : (promptTemplate || getDetailedRedesignPromptsTemplate(numImages));
    
    // Call cloud API
    const result = await cloudApiService.detailedRedesignPrompts(
      file, 
      concept, 
      numImages, 
      systemPrompt
    );
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to generate prompts');
    }
    
    return result.data;
    
  } catch (error) {
    console.error('Detailed redesign prompts failed:', error);
    // Fallback to basic prompts
    return Array(numImages).fill(null).map((_, i) => 
      `${concept} - Variation ${i + 1}, high detail, professional quality`
    );
  }
}
```

---

### **Phase 3: UI Components Verification** ⏱️ 2 hours

#### Step 3.1: Check MaskPromptPopup
```bash
# Read component
code "c:\autoagents-app\src\components\MaskPromptPopup.tsx"
```

**Checklist:**
- [ ] Has text input for prompt
- [ ] Has image drop zone (for combining images)
- [ ] Has "Generate" button
- [ ] Has "Cancel" button
- [ ] Positioned relative to mask center
- [ ] Supports both simple & fix inpainting

**If missing features:**
```typescript
// Compare with AutoAgents-Redesign version
diff "c:\Users\ADMIN\AutoAgents-Redesign\components\MaskPromptPopup.tsx" "c:\autoagents-app\src\components\MaskPromptPopup.tsx"
```

#### Step 3.2: Check VariationViewer
```bash
code "c:\autoagents-app\src\components\VariationViewer.tsx"
```

**Checklist:**
- [ ] Left/right navigation arrows
- [ ] Current index display (1/4)
- [ ] Preview of variations
- [ ] Accept button
- [ ] Cancel button (restore original)

#### Step 3.3: Verify Toolbar Redesign UI
```bash
code "c:\autoagents-app\src\components\Toolbar.tsx"
```

**Checklist for Edit Mode:**
- [ ] Redesign suggestions chips displayed
- [ ] Manual prompt input visible
- [ ] "Redesign" button (calls `onManualRedesign`)
- [ ] Number of images picker
- [ ] Model selector (Gemini/OpenAI)

---

### **Phase 4: Testing & Validation** ⏱️ 2 hours

#### Test Case 1: AI Suggestions
```
1. Switch to Redesign mode
2. Upload t-shirt design image
3. Wait for suggestions to load
4. Verify 3-4 suggestion chips appear
5. Click a suggestion
6. Verify variations are generated
7. Browse variations
8. Click Accept
9. Verify base image replaced
```

#### Test Case 2: Manual Redesign
```
1. Upload image in Redesign mode
2. Type prompt: "make it cyberpunk style"
3. Select "4" in number picker
4. Click "Redesign"
5. Verify 4 variations generated
6. Verify variations are different (not mock)
7. Accept one variation
```

#### Test Case 3: Inpainting
```
1. Upload image
2. Select Brush tool
3. Draw mask over object
4. MaskPromptPopup appears
5. Type: "change to red color"
6. Click Generate
7. Verify masked area edited
```

#### Test Case 4: AI Eraser
```
1. Upload image with unwanted object
2. Select AI Eraser
3. Draw over object
4. Object removed automatically (no dialog)
5. Verify clean background
```

#### Test Case 5: Generative Crop
```
1. Upload image
2. Select Crop tool
3. Expand crop rect beyond image
4. Click "Generative Crop"
5. Verify expanded area filled with AI
```

---

## 📝 CHECKLIST TỔNG HỢP

### **Must Have (P0 - Critical)**
- [x] `prompts.ts` file created with all prompts ✅ (Already exists!)
- [x] `generateDetailedRedesignPrompts()` calls real API (not mock) ✅ (DONE - Updated!)
- [x] Backend endpoint `/api/proxy/detailed-redesign-prompts` working ✅ (DONE - Added!)
- [x] `cloudApiService.detailedRedesignPrompts()` method added ✅ (DONE!)
- [ ] Manual Redesign flow generates real variations (Need to test)
- [x] AI Suggestions auto-load on image upload ✅ (Already working)
- [ ] Inpainting with MaskPromptBox works (Need to verify)
- [ ] AI Eraser removes objects cleanly (Need to test)

### **Should Have (P1 - Important)**
- [ ] VariationViewer shows all variations
- [ ] Left/right navigation in VariationViewer
- [ ] Number of images picker works (1-4)
- [ ] Generative Crop expands & fills
- [ ] Keyboard shortcuts work in Edit mode

### **Nice to Have (P2 - Enhancement)**
- [ ] Debug popup (Alt+Click) shows prompts
- [ ] Tooltip messages match AutoAgents-Redesign
- [ ] Loading messages specific to Edit mode
- [ ] Error messages user-friendly

---

## 🚀 DEPLOYMENT CHECKLIST

### **Backend (autoagents-cloud)**
- [ ] Add `/api/proxy/detailed-redesign-prompts` endpoint
- [ ] Test with Postman/curl
- [ ] Verify Gemini 2.5 Flash quota
- [ ] Deploy to production server
- [ ] Update `.env` with API keys

### **Frontend (autoagents-app)**
- [ ] Copy `prompts.ts` file
- [ ] Update imports in `App.tsx`, `geminiService.ts`
- [ ] Update `cloudApiService.ts` with new method
- [ ] Update `geminiService.ts` implementation
- [ ] Test locally with dev server
- [ ] Build production (`npm run build`)
- [ ] Deploy to hosting

---

## 📚 FILES NEED TO EDIT

### New Files
1. `c:\autoagents-app\src\prompts.ts` ⭐ **CREATE**

### Modified Files
1. `c:\autoagents-app\src\App.tsx`
   - Import prompts
   - Update `executeRedesign()`
   - Update `handleAIEraserGeneration()`
   - Update `handleMaskedGeneration()`

2. `c:\autoagents-app\src\services\geminiService.ts`
   - Import prompts
   - Update `generateDetailedRedesignPrompts()`
   - Update `generateRedesignConcepts()`

3. `c:\autoagents-app\lib\services\cloudApiService.ts`
   - Add `detailedRedesignPrompts()` method

4. `c:\autoagents-cloud\server\routes\proxy.js` (or similar)
   - Add `/detailed-redesign-prompts` endpoint

5. `c:\autoagents-app\src\components\MaskPromptPopup.tsx` (if needed)
   - Verify all features present

6. `c:\autoagents-app\src\components\VariationViewer.tsx` (if needed)
   - Verify left/right navigation

---

## 🎯 SUCCESS CRITERIA

### ✅ Edit Mode là thành công khi:

1. **Upload ảnh** → AI suggestions tự động xuất hiện trong 3s
2. **Click suggestion** → Generate 3-4 variations khác nhau (KHÔNG phải mock)
3. **Manual redesign** với prompt → Generate variations theo đúng prompt
4. **Brush tool + mask** → Inpainting dialog xuất hiện, edit đúng vùng
5. **AI Eraser** → Xóa objects, background tự động fill
6. **Generative Crop** → Expand canvas, AI fill phần mới
7. **Keyboard shortcuts** hoạt động (B, E, C, Shift+Enter, etc.)
8. **Undo/Redo** hoạt động cho Edit history
9. **Export** xuất đúng ảnh đã edit
10. **No console errors** khi dùng Edit mode

---

## 📞 NEXT STEPS

**Bước 1**: Bắt đầu với Phase 1 (Create prompts.ts)
**Bước 2**: Implement Phase 2 (Backend endpoint)
**Bước 3**: Test Phase 3 (UI verification)
**Bước 4**: Validate Phase 4 (End-to-end testing)

**Estimated Total Time**: 9-12 hours

---

## 🔗 REFERENCES

- Source: `c:\Users\ADMIN\AutoAgents-Redesign\App.tsx`
- Source: `c:\Users\ADMIN\AutoAgents-Redesign\services\geminiService.ts`
- Source: `c:\Users\ADMIN\AutoAgents-Redesign\prompts.ts`
- Target: `c:\autoagents-app\src\*`
- Cloud API: `c:\autoagents-cloud\server\routes\proxy.js`

---

**🎉 END OF SKETCH**
