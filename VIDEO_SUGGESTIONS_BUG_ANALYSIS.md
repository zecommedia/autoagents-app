# 🐛 VIDEO SUGGESTIONS BUG - ROOT CAUSE ANALYSIS

## ❌ VẤN ĐỀ

**Lỗi**: `POST http://localhost:4000/proxy/chat 400 (Bad Request)`

---

## 🔍 ROOT CAUSE

### **1. Frontend gửi SAI FORMAT**

**File**: `autoagents-app/src/services/geminiService.ts` - Line 194

```typescript
// ❌ SAI: Gửi messages array KHÔNG CÓ IMAGE
const result = await cloudApiService.chat([
  {
    role: 'user',
    parts: [
      { text: systemPrompt } // ❌ Chỉ có text, KHÔNG CÓ IMAGE!
    ]
  }
], 'gemini');
```

### **2. Server endpoint KHÔNG ACCEPT IMAGE**

**File**: `cloud-api-server/server.js` - Line 630

```javascript
app.post('/proxy/chat', authenticateToken, async (req, res) => {
  try {
    const { messages, model: selectedModel, stream = false } = req.body;
    
    // ❌ Chỉ nhận `messages` array, KHÔNG SUPPORT IMAGE!
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }
    
    // ... code xử lý chỉ text chat
  }
});
```

---

## ✅ SO SÁNH VỚI AUTOAGENTS-REDESIGN GỐC

### **AutoAgents-Redesign (ĐÚNG)**

**File**: `AutoAgents-Redesign/services/geminiService.ts` - Lines 197-231

```typescript
export const generateVideoSuggestions = async (
    imageSrc: string, 
    getPrompt: () => string
): Promise<VideoSuggestion[]> => {
    try {
        const imagePart = await dataUrlToPart(imageSrc); // ✅ Convert image to Part
        const prompt = getPrompt();
        
        // ✅ GỌI TRỰC TIẾP GEMINI SDK
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, { text: prompt }] }, // ✅ GỬI CẢ IMAGE VÀ TEXT
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            vi: { type: Type.STRING },
                            en: { type: Type.STRING }
                        },
                        required: ["vi", "en"]
                    }
                }
            }
        });

        const jsonText = response.text.trim();
        const suggestions: VideoSuggestion[] = JSON.parse(jsonText);
        return suggestions;

    } catch (error) {
        console.error("Error generating video suggestions:", error);
        return [];
    }
};
```

---

## 🎯 GIẢI PHÁP

### **OPTION 1: Tạo endpoint `/proxy/generate-suggestions` riêng**

#### **Backend**: `cloud-api-server/server.js`

```javascript
app.post('/proxy/generate-suggestions', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { prompt } = req.body;
    const imageFile = req.file;

    if (!imageFile || !prompt) {
      return res.status(400).json({ error: 'Image and prompt required' });
    }

    logger.info(`POST /proxy/generate-suggestions (user ${req.user.userId})`);

    // Convert image to base64
    const imageBuffer = imageFile.buffer;
    const imageBase64 = imageBuffer.toString('base64');

    // Call Gemini with image + structured output
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: FunctionDeclarationSchemaType.ARRAY,
          items: {
            type: FunctionDeclarationSchemaType.OBJECT,
            properties: {
              vi: { type: FunctionDeclarationSchemaType.STRING },
              en: { type: FunctionDeclarationSchemaType.STRING }
            },
            required: ["vi", "en"]
          }
        }
      }
    });

    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType: imageFile.mimetype
        }
      },
      { text: prompt }
    ]);

    const suggestions = JSON.parse(result.response.text());

    res.json({
      success: true,
      data: suggestions
    });

  } catch (error) {
    logger.error('Generate suggestions error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
```

#### **Frontend**: `autoagents-app/lib/services/cloudApiService.ts`

```typescript
// Add new method
async generateSuggestions(image: File, prompt: string) {
  const formData = new FormData();
  formData.append('image', image, 'image.png');
  formData.append('prompt', prompt);

  return this.request({
    endpoint: '/proxy/generate-suggestions',
    data: formData,
    timeout: 30000,
  });
}
```

#### **Frontend**: `autoagents-app/src/services/geminiService.ts`

```typescript
export async function generateVideoSuggestions(
  imageDataUrl: string,
  promptTemplate?: string | (() => string)
): Promise<VideoSuggestion[]> {
  try {
    // Convert image to File
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();
    const file = new File([blob], 'image.png', { type: blob.type });

    // Get prompt
    const prompt = typeof promptTemplate === 'function' ? promptTemplate() : promptTemplate || getVideoSuggestionsPrompt();

    // ✅ Call new endpoint
    const result = await cloudApiService.generateSuggestions(file, prompt);

    if (result.success && result.data) {
      return result.data;
    }

    // Fallback
    return [
      { vi: 'Hơi nước', en: 'Cinematic shot of steam slowly rising.' },
      { vi: 'Camera Pan', en: 'Smooth left-to-right camera pan.' }
    ];
  } catch (error) {
    console.error('Video suggestions failed:', error);
    return [
      { vi: 'Hơi nước', en: 'Cinematic shot of steam slowly rising.' },
      { vi: 'Camera Pan', en: 'Smooth left-to-right camera pan.' }
    ];
  }
}
```

---

### **OPTION 2: Sửa `/proxy/chat` để accept image (KHÔNG KHUYẾN NGHỊ)**

Quá phức tạp vì phải thay đổi logic hiện có.

---

### **OPTION 3: TEMPORARY FIX - Trả về hardcoded suggestions**

```typescript
export async function generateVideoSuggestions(
  imageDataUrl: string,
  promptTemplate?: string | (() => string)
): Promise<VideoSuggestion[]> {
  // ⚠️ TEMPORARY: Return hardcoded suggestions until server endpoint is fixed
  console.warn('Video suggestions using fallback data (server endpoint not ready)');
  
  return [
    { vi: 'Hơi nước', en: 'Cinematic shot of steam slowly rising, with subtle camera movement.' },
    { vi: 'Tua nhanh', en: 'Timelapse of bustling activity in the background.' },
    { vi: 'Cận cảnh', en: 'A dramatic slow-motion dolly zoom focusing on details.' },
    { vi: 'Zoom In', en: 'Gradually zoom into the main subject with cinematic feel.' }
  ];
}
```

---

## 🎯 KHUYẾN NGHỊ

**CHỌN OPTION 1** - Tạo endpoint `/proxy/generate-suggestions` riêng:

### **Lý do:**
✅ Đơn giản, rõ ràng
✅ Không ảnh hưởng đến `/proxy/chat` hiện có  
✅ Dễ maintain
✅ Match với AutoAgents-Redesign logic

### **Implementation Steps:**
1. ✅ Add endpoint `/proxy/generate-suggestions` vào `server.js`
2. ✅ Add method `generateSuggestions()` vào `cloudApiService.ts`
3. ✅ Update `generateVideoSuggestions()` trong `geminiService.ts`
4. ✅ Test với real image
5. ✅ Verify JSON format `{vi, en}`

---

## 📝 TÓM TẮT

**Vấn đề**: Video suggestions gọi `/proxy/chat` nhưng endpoint này không support image.

**Nguyên nhân**: Frontend + Server đều không được thiết kế để xử lý image trong chat endpoint.

**Giải pháp tốt nhất**: Tạo endpoint mới `/proxy/generate-suggestions` chuyên dụng cho video suggestions.

**Bạn muốn tôi implement OPTION 1 ngay không?**
