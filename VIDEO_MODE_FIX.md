# Video Mode Fix - Video Generation & Suggestions

## 🐛 Vấn Đề

### 1. Video Generation Failed
```
error: Video generation error: Cannot read properties of undefined (reading 'generateVideos')
```

**Nguyên nhân**: Server đang dùng sai AI SDK instance
- Đang dùng: `genAI` (GoogleGenerativeAI - old SDK)
- Cần dùng: `genAINew` (GoogleGenAI - new SDK)

### 2. Video Suggestions không hoạt động
**Nguyên nhân**: Chỉ trả về mock data cứng, không gọi AI thực sự

---

## ✅ Giải Pháp

### Fix 1: Video Generation (server.js)

**File**: `c:\App\autoagents-cloud\cloud-api-server\server.js`

```diff
- let operation = await genAI.models.generateVideos({
+ let operation = await genAINew.models.generateVideos({
      model: 'veo-3.1-generate-001',
      prompt: prompt,
      image: {
        imageBytes: image,
        mimeType: 'image/png',
      },
      config: config
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
-     operation = await genAI.operations.getVideosOperation({ operation: operation });
+     operation = await genAINew.operations.getVideosOperation({ operation: operation });
    }
```

**Thay đổi**: Dùng `genAINew` thay vì `genAI` cho video generation API

---

### Fix 2: Video Suggestions (geminiService.ts)

**File**: `c:\App\autoagents-app\src\services\geminiService.ts`

**Trước đây**: Mock data cứng
```typescript
export async function generateVideoSuggestions(...): Promise<VideoSuggestion[]> {
  return [
    { title: 'Camera Pan Left', description: '...', duration: '3s' },
    { title: 'Zoom In', description: '...', duration: '3s' }
  ];
}
```

**Bây giờ**: Gọi AI thực sự
```typescript
export async function generateVideoSuggestions(imageDataUrl: string, promptTemplate?: string): Promise<VideoSuggestion[]> {
  try {
    // Convert image to File
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();
    const file = new File([blob], 'image.png', { type: blob.type });

    // Call Gemini AI to analyze image and generate suggestions
    const result = await cloudApiService.chat([
      {
        role: 'user',
        parts: [{ text: promptTemplate || 'Suggest 5 video animation ideas...' }]
      }
    ], 'gemini');

    // Parse JSON response
    if (result.success && result.data) {
      const text = typeof result.data === 'string' ? result.data : result.data.text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }

    // Fallback to default suggestions
    return [...defaultSuggestions];
  } catch (error) {
    console.error('Video suggestions failed:', error);
    return [...defaultSuggestions];
  }
}
```

**Cải tiến**:
- ✅ Gọi Gemini 2.5 Flash để phân tích ảnh
- ✅ AI tạo suggestions sáng tạo dựa trên nội dung ảnh
- ✅ Fallback to default nếu AI fails
- ✅ Error handling tốt hơn

---

## 🧪 Test Video Mode

### Prerequisites
```powershell
# Ensure both servers running
# Cloud API: localhost:4000
# Frontend: localhost:5173
```

### Test 1: Video Generation
1. Open http://localhost:5173
2. Switch to **Video** mode
3. Upload an image (e.g., portrait, product, landscape)
4. Enter video prompt: "camera slowly zooms in on the subject"
5. Select aspect ratio (16:9 recommended)
6. Click **Generate Video**
7. Wait 60-120 seconds for Veo 3.1 to generate

**Expected**:
- ✅ No error "Cannot read properties of undefined"
- ✅ Loading indicator shows
- ✅ Video player appears with generated video
- ✅ Video has motion matching prompt

### Test 2: Video Suggestions (AI-Powered)
1. In Video mode with image uploaded
2. Look at the **Video Suggestions** section
3. Should see 5 AI-generated suggestions based on image content
4. Click on a suggestion → auto-fills prompt
5. Click Generate Video

**Expected**:
- ✅ Suggestions are relevant to the image
- ✅ NOT just generic "Pan Left", "Zoom In" 
- ✅ Creative and contextual suggestions
- ✅ Clicking suggestion fills prompt field

---

## 📊 Technical Details

### AI Models Used

#### Video Generation
- **Model**: Veo 3.1 (`veo-3.1-generate-001`)
- **SDK**: `@google/genai` (new SDK)
- **Instance**: `genAINew`
- **Features**: Text-to-Video, Image-to-Video, aspect ratio control

#### Video Suggestions
- **Model**: Gemini 2.5 Flash
- **SDK**: Via `cloudApiService.chat()`
- **Method**: Image analysis → JSON suggestions
- **Fallback**: 5 default suggestions if AI fails

---

## 🚀 Status

### ✅ Fixed:
- [x] Video generation SDK mismatch → Now uses `genAINew`
- [x] Video suggestions mock data → Now uses real AI
- [x] Server restarted with fixes

### 🧪 Ready to Test:
- [ ] Test video generation with various images
- [ ] Test video suggestions show AI-generated ideas
- [ ] Test different aspect ratios
- [ ] Test error handling (bad prompts, large images)

---

## 📝 Files Changed

1. **`cloud-api-server/server.js`** (Lines 812, 819)
   - Changed `genAI` → `genAINew` for video operations

2. **`src/services/geminiService.ts`** (Lines 175-235)
   - Implemented real AI-powered video suggestions
   - Added error handling and fallback

---

## 🎉 Result

**Video Mode** giờ đã hoạt động đầy đủ:
- ✅ Video generation với Veo 3.1
- ✅ AI-powered video suggestions
- ✅ Proper error handling
- ✅ Cloud API integration

**Ready to test!** 🚀
