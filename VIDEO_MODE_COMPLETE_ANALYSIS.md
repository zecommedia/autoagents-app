# 📊 VIDEO MODE - COMPLETE ANALYSIS & IMPLEMENTATION PLAN

## 🎯 MỤC TIÊU
Clone y hệt Video Mode từ **AutoAgents-Redesign** sang **autoagents-app**, chỉ thay Google AI SDK trực tiếp bằng cloudApiService.

---

## ✅ PHÂN TÍCH AUTOAGENTS-REDESIGN GỐC

### **1. VIDEO MODE FEATURES (AutoAgents-Redesign)**

#### **A. State Management**
```typescript
// App.tsx lines 329-330
const [videoAspectRatio, setVideoAspectRatio] = useState<VideoAspectRatio>('auto');
const [videoSuggestions, setVideoSuggestions] = useState<VideoSuggestion[]>([]);
const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
const [loadingMessage, setLoadingMessage] = useState('');
```

#### **B. Auto-fetch Video Suggestions**
```typescript
// App.tsx lines 387-407
useEffect(() => {
    const fetchSuggestions = async () => {
        if (appMode === 'video' && imageForVideo) {
            setIsLoadingSuggestions(true);
            setVideoSuggestions([]);
            try {
                const suggestions = await generateVideoSuggestions(
                    imageForVideo.src, 
                    getVideoSuggestionsPrompt
                );
                setVideoSuggestions(suggestions);
            } catch (error) {
                console.error("Failed to fetch video suggestions", error);
                setVideoSuggestions([]);
            } finally {
                setIsLoadingSuggestions(false);
            }
        } else {
            setVideoSuggestions([]);
        }
    };
    
    fetchSuggestions();
}, [appMode, imageForVideo]);
```

#### **C. Video Generation Function**
```typescript
// App.tsx lines 1750-1782
const handleGenerateVideo = useCallback(async () => {
    if (!imageForVideo) {
        alert("Please upload an image to generate a video from.");
        return;
    }
    const userPrompt = prompt.trim();
    if (!userPrompt) {
        alert("Please enter a prompt to describe the video you want to create.");
        return;
    }

    setIsGeneratingVideo(true);
    setGeneratedVideoUrl(null);
    
    try {
        setLoadingMessage(videoGenerationMessages[0]);
        
        // 🔥 CRITICAL: Safety bypass prefix
        const bypassPrefix = "A photorealistic, animated rendering of a character. ";
        const finalPrompt = bypassPrefix + userPrompt;

        const videoUrl = await generateVideoFromImageAndPrompt(
            finalPrompt, 
            imageForVideo.src, 
            videoAspectRatio // 🔥 CRITICAL: Pass aspect ratio
        );
        setGeneratedVideoUrl(videoUrl);

    } catch (error) {
        console.error("Video generation failed:", error);
        alert(`Video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        setIsGeneratingVideo(false);
        setLoadingMessage('');
    }
}, [imageForVideo, prompt, videoAspectRatio]); // 🔥 CRITICAL: videoAspectRatio dependency
```

#### **D. geminiService.ts - Video Generation**
```typescript
// geminiService.ts lines 135-195
export const generateVideoFromImageAndPrompt = async (
    prompt: string,
    imageSrc: string,
    aspectRatio: 'auto' | '16:9' | '9:16' | '1:1',
): Promise<string> => {
    try {
        const imagePart = await dataUrlToPart(imageSrc);
        
        const config: { numberOfVideos: number, aspectRatio?: '16:9' | '9:16' | '1:1' } = {
            numberOfVideos: 1
        };

        // 🔥 Only add aspectRatio if not 'auto'
        if (aspectRatio !== 'auto') {
            config.aspectRatio = aspectRatio;
        }

        let operation = await ai.models.generateVideos({
            model: 'veo-2.0-generate-001',
            prompt: prompt,
            image: {
                imageBytes: imagePart.inlineData.data,
                mimeType: imagePart.inlineData.mimeType,
            },
            config: config
        });

        // 🔥 POLLING: Wait for operation to complete
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }
        
        // 🔥 Error handling
        if (operation.error) {
            const apiError = operation.error;
            const errorMessage = apiError.message || `API Error Code: ${apiError.code}`;
            console.error("Video generation operation failed with an error:", apiError);
            throw new Error(String(errorMessage));
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

        if (!downloadLink) {
            throw new Error("Video generation completed, but no download link was provided. This might be due to content safety filters.");
        }

        // 🔥 Download video with API key
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Failed to download video file. Status:", response.status, "Body:", errorBody);
            throw new Error(`Failed to download video file: ${response.statusText}`);
        }
        const videoBlob = await response.blob();
        
        // 🔥 Return Blob URL
        return URL.createObjectURL(videoBlob);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error("Error calling Gemini Video Generation API:", error);
        throw new Error(`Failed to generate video with Gemini API: ${errorMessage}`);
    }
};
```

#### **E. geminiService.ts - Video Suggestions**
```typescript
// geminiService.ts lines 197-231
export const generateVideoSuggestions = async (
    imageSrc: string, 
    getPrompt: () => string
): Promise<VideoSuggestion[]> => {
    try {
        const imagePart = await dataUrlToPart(imageSrc);
        const prompt = getPrompt();
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, { text: prompt }] },
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

#### **F. Toolbar Props**
```typescript
// App.tsx lines 2590-2591
videoAspectRatio={videoAspectRatio}
onVideoAspectRatioChange={setVideoAspectRatio}
```

#### **G. Video Display**
```typescript
// App.tsx lines 2391-2396
{appMode === 'video' && generatedVideoUrl && !isGeneratingVideo && (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video src={generatedVideoUrl} controls style={{ maxWidth: '100%', maxHeight: '100%' }} />
    </div>
)}
```

---

## ⚠️ TÌNH TRẠNG AUTOAGENTS-APP HIỆN TẠI

### **SO SÁNH CHI TIẾT**

| Feature | AutoAgents-Redesign | autoagents-app | Status |
|---------|---------------------|----------------|--------|
| **videoAspectRatio state** | ✅ Line 329 | ❌ MISSING | 🔴 CẦN THÊM |
| **Auto-fetch suggestions** | ✅ Lines 387-407 | ✅ Lines 397-414 | ✅ CÓ |
| **Safety bypass prefix** | ✅ Line 1767 | ✅ Line 1987 | ✅ CÓ |
| **Pass aspectRatio param** | ✅ Line 1772 | ✅ Line 1992 | ✅ CÓ |
| **generateVideoFromImageAndPrompt** | ✅ Direct SDK | ✅ cloudApiService | ✅ CÓ |
| **generateVideoSuggestions** | ✅ Direct SDK | ✅ cloudApiService | ✅ CÓ |
| **Toolbar aspect ratio selector** | ✅ Props passed | ❓ UNKNOWN | 🟡 CẦN CHECK |
| **Video display** | ✅ Lines 2391-2396 | ❓ UNKNOWN | 🟡 CẦN CHECK |
| **Server video endpoint** | N/A | ✅ Working | ✅ CÓ |
| **Server chat endpoint** | N/A | ❌ 400 Error | 🔴 BUG |
| **Database logging** | N/A | ❌ Commented out | 🟡 TEMPORARY FIX |

---

## 🐛 CÁC LỖI HIỆN TẠI

### **1. Video Suggestions - 400 Bad Request** ❌
- **Lỗi**: `POST http://localhost:4000/proxy/chat 400 (Bad Request)`
- **Nguyên nhân**: Server `/proxy/chat` endpoint có vấn đề
- **File**: `cloud-api-server/server.js` - chat endpoint
- **Fix**: Cần kiểm tra lại request format

### **2. Database Type Mismatch** ⚠️
- **Lỗi**: `invalid input syntax for type integer: "demo-user-1"`
- **Nguyên nhân**: `userId` column là INTEGER nhưng JWT token trả về STRING
- **File**: `cloud-api-server/server.js` - lines 842, 849
- **Fix**: ✅ ĐÃ COMMENT OUT (temporary)

### **3. Video không load** ❓
- **Lỗi**: Video player shows 0:00, màn hình đen
- **Nguyên nhân**: Có thể Blob URL không hợp lệ
- **Fix**: Cần test lại sau khi fix database

---

## 🎯 HÀNH ĐỘNG CẦN THIẾT

### **PRIORITY 1: FIX VIDEO SUGGESTIONS (400 ERROR)** 🔥

#### **Bước 1: Kiểm tra server `/proxy/chat` endpoint**
```javascript
// cloud-api-server/server.js
app.post('/proxy/chat', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { prompt } = req.body;
        const imageFile = req.file;
        
        // 🔥 LOG REQUEST để debug
        logger.info('POST /proxy/chat');
        logger.info(`Prompt: ${prompt}`);
        logger.info(`Image: ${imageFile ? 'YES' : 'NO'}`);
        
        // ... rest of code
    }
});
```

#### **Bước 2: Kiểm tra frontend request format**
```typescript
// lib/services/cloudApiService.ts - chat() method
const formData = new FormData();
formData.append('prompt', prompt);
if (image) {
    formData.append('image', image, 'image.png');
}

// 🔥 LOG REQUEST để debug
console.log('📤 Sending chat request:', { 
    prompt: prompt.substring(0, 100), 
    hasImage: !!image 
});
```

### **PRIORITY 2: TEST VIDEO GENERATION**

#### **Test Steps:**
1. Upload ảnh vào Video Mode
2. Nhập prompt: "chiếc áo đang bay"
3. Nhấn Generate Video
4. Chờ 60-120 giây
5. **EXPECTED**: Video xuất hiện và play được

#### **Expected Behavior:**
- ✅ Không còn lỗi database
- ✅ Video URL được trả về
- ✅ Video player hiển thị
- ✅ Video có thể play

### **PRIORITY 3: ADD MISSING FEATURES (NẾU CẦN)**

#### **A. Video Aspect Ratio Selector**
Nếu Toolbar chưa có, cần thêm:
```typescript
// Toolbar.tsx
{appMode === 'video' && (
    <select 
        value={videoAspectRatio} 
        onChange={(e) => onVideoAspectRatioChange(e.target.value as VideoAspectRatio)}
    >
        <option value="auto">Auto</option>
        <option value="16:9">16:9</option>
        <option value="9:16">9:16 (Portrait)</option>
        <option value="1:1">1:1 (Square)</option>
    </select>
)}
```

---

## 📝 TESTING CHECKLIST

### **Video Mode Features**
- [ ] Upload ảnh vào Video Mode
- [ ] Video suggestions tự động load
- [ ] Suggestions có format đúng `{vi, en}`
- [ ] Click suggestion điền vào prompt
- [ ] Chọn aspect ratio (auto/16:9/9:16/1:1)
- [ ] Generate video thành công
- [ ] Video hiển thị đúng tỷ lệ
- [ ] Video có thể play
- [ ] Video có controls (play/pause/volume)

### **Integration with Cloud API**
- [ ] `/proxy/video` endpoint hoạt động
- [ ] `/proxy/chat` endpoint hoạt động (suggestions)
- [ ] Database logging không gây lỗi
- [ ] Video URL được download và cache

---

## 🔧 CODE REFERENCES

### **Files cần check:**
1. ✅ `c:\App\autoagents-app\src\App.tsx` - Video mode logic
2. ✅ `c:\App\autoagents-app\src\services\geminiService.ts` - Cloud API wrapper
3. ✅ `c:\App\autoagents-app\lib\services\cloudApiService.ts` - API client
4. ⚠️ `c:\App\autoagents-cloud\cloud-api-server\server.js` - Server endpoints
5. ❓ `c:\App\autoagents-app\components\Toolbar.tsx` - Aspect ratio selector

### **Comparison với gốc:**
- **Gốc**: `c:\Users\Admin\AutoAgents-Redesign\App.tsx`
- **Gốc**: `c:\Users\Admin\AutoAgents-Redesign\services\geminiService.ts`

---

## ✅ CONCLUSION

**autoagents-app Video Mode đã GẦN HOÀN CHỈNH!**

**Còn thiếu:**
1. 🔴 Fix `/proxy/chat` 400 error (video suggestions)
2. 🟡 Test video generation end-to-end
3. 🟡 Verify aspect ratio selector in Toolbar

**Đã có:**
- ✅ Video generation logic
- ✅ Safety bypass prefix
- ✅ Aspect ratio support
- ✅ Cloud API integration
- ✅ Auto-fetch suggestions (có bug)
- ✅ Video display UI

**Next Step: DEBUG `/proxy/chat` endpoint!**
