# Chat Mode Improvements - Based on AutoAgents-Redesign

## 📋 Phân tích từ AutoAgents-Redesign

### 1. **Multi-Image Handling** (Lines 596-646)
```typescript
// Phát hiện số lượng ảnh
const imageParts = currentUserParts.filter(p => 'inlineData' in p);

if (imageParts.length === 1) {
    // SINGLE IMAGE EDIT - Sử dụng Cloud API
    const dataUrl = `data:${imageParts[0].inlineData.mimeType};base64,${imageParts[0].inlineData.data}`;
    const resultImageBase64 = await generateImageViaCloudApi(dataUrl, textPart.text, 'edit', 'gemini');
    
} else if (imageParts.length === 2) {
    // MULTI-IMAGE - Hiển thị thông báo hướng dẫn
    setChatHistory(prev => {
        const newHistory = [...prev];
        newHistory[modelResponseIndex] = {
            role: 'model',
            parts: [{ 
                text: `⚠️ Multi-image editing detected! Currently only single image editing is supported in Chat mode.\n\nPlease use:\n- **Clone mode** for combining 2 images\n- Or send images one at a time` 
            }],
            provider
        };
        return newHistory;
    });
}
```

### 2. **Provider Logic Separation** (Lines 696-880)

#### **OpenAI Path:**
- **CASE 1**: Text-only chat → GPT-5 API
- **CASE 2**: Image generation from text → DALL-E 3
- **CASE 3**: Single image edit → DALL-E 2 Edit API  
- **CASE 4**: Multi-image → Warning message

#### **Gemini Path:**
- **TEXT-ONLY**: Cloud API chat endpoint
- **SINGLE IMAGE**: Cloud API redesign with 'gemini' model
- **MULTI-IMAGE**: Warning message

### 3. **Prompt Detection Logic** (Line 733)
```typescript
const wantsImageGen = imageParts.length === 0 && 
    /\b(generate|create|draw|vẽ|tạo ảnh|tao anh|tạo hình|tao hinh|tạo|ve)\b/i.test(textInPrompt);
```

### 4. **Error Handling** (Lines 850-870)
```typescript
try {
    const result = await cloudApiService.chat(messages, 'gemini');
    
    if (!result.success) {
        throw new Error(result.error || 'Chat failed');
    }

    // Extract response carefully
    const responseText = result.data?.data || result.data || '';
    
} catch (error: any) {
    console.error("Gemini chat via Cloud API failed:", error);
    setChatHistory(prev => {
        const newHistory = [...prev];
        newHistory[modelResponseIndex] = {
            role: 'model',
            parts: [{ text: `Sorry, chat failed: ${error.message || 'Unknown error'}` }],
            provider
        };
        return newHistory;
    });
}
```

---

## ✅ Các cải tiến cần áp dụng cho autoagents-app

### 1. **Cải tiến xử lý Multi-Image**

**File: `src/App.tsx`, function `executeChatTurn`**

```typescript
// THAY THẾ CODE CŨ (Line ~730-760)
if (provider === 'openai') {
    const hasImage = currentUserParts.some(p => 'inlineData' in p);
    const textInPrompt = currentUserParts.filter((p: any) => p.text)...
    
    if (hasImage) {
        const imageUrls = currentUserParts.filter(p => 'inlineData' in p)...
        // Xử lý chỉ 1 ảnh
    }
}

// BẰNG CODE MỚI:
if (provider === 'openai') {
    // Count and extract images properly
    const imageParts = currentUserParts.filter(p => 'inlineData' in p);
    const textPart = currentUserParts.find(p => 'text' in p);
    const textInPrompt = textPart?.text || '';
    const wantsImageGen = imageParts.length === 0 && 
        /\b(generate|create|draw|vẽ|tạo ảnh|tao anh|tạo hình|tao hinh|tạo|ve)\b/i.test(textInPrompt);

    // CASE 1: Text-only chat
    if (imageParts.length === 0 && !wantsImageGen) {
        const messages = historySoFar.map((msg: any) => ({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.parts?.map((p: any) => p.text || '').join(' ') || ''
        }));
        messages.push({ role: 'user', content: textInPrompt });

        const result = await cloudApiService.chat(messages, 'openai');
        // ... xử lý response
        return;
    }

    // CASE 2: Image generation
    if (wantsImageGen) {
        setChatHistory(prev => {
            const newHistory = [...prev];
            newHistory[modelResponseIndex] = { 
                role: 'model', 
                parts: [{ text: 'OK, generating an image...' }], 
                provider 
            };
            return newHistory;
        });
        
        const images = await openAIGenerateFromPrompt(textInPrompt, 1);
        // ... xử lý kết quả
        return;
    }

    // CASE 3: Single image edit
    if (imageParts.length === 1 && textPart) {
        const dataUrl = `data:${imageParts[0].inlineData.mimeType};base64,${imageParts[0].inlineData.data}`;
        const resultImageBase64 = await generateImageViaCloudApi(dataUrl, textInPrompt, 'edit', 'openai');
        
        let imageBase64 = resultImageBase64;
        if (typeof resultImageBase64 === 'string' && resultImageBase64.includes(',')) {
            imageBase64 = resultImageBase64.split(',')[1];
        }
        
        setChatHistory(prev => {
            const newHistory = [...prev];
            newHistory[modelResponseIndex] = {
                role: 'model',
                parts: [
                    { text: `Here's the edited image:` },
                    { inlineData: { data: imageBase64, mimeType: 'image/png' } }
                ],
                provider
            };
            return newHistory;
        });
        return;
    }

    // CASE 4: Multi-image (2 images) - Not supported
    if (imageParts.length === 2) {
        setChatHistory(prev => {
            const newHistory = [...prev];
            newHistory[modelResponseIndex] = {
                role: 'model',
                parts: [{ 
                    text: `⚠️ Multi-image editing detected! Currently only single image editing is supported in Chat mode.\n\nPlease use:\n- **Clone mode** for combining 2 images\n- Or send images one at a time` 
                }],
                provider
            };
            return newHistory;
        });
        return;
    }

    // Too many images
    if (imageParts.length > 2) {
        throw new Error('Too many images. Maximum 2 images supported.');
    }
}
```

### 2. **Cải tiến xử lý Gemini**

```typescript
// GEMINI PATH
if (provider === 'gemini') {
    try {
        // Count images
        const imageParts = currentUserParts.filter(p => 'inlineData' in p);
        const textPart = currentUserParts.find(p => 'text' in p);
        
        // IMAGE EDITING MODE (1 or 2 images)
        if (imageParts.length > 0 && textPart) {
            console.log(`🖼️ Gemini Image Edit Mode - ${imageParts.length} image(s)`);
            
            if (imageParts.length === 1) {
                // SINGLE IMAGE EDIT
                const dataUrl = `data:${imageParts[0].inlineData.mimeType};base64,${imageParts[0].inlineData.data}`;
                const resultImageBase64 = await generateImageViaCloudApi(dataUrl, textPart.text, 'edit', 'gemini');
                
                let imageBase64 = resultImageBase64;
                if (typeof resultImageBase64 === 'string' && resultImageBase64.includes(',')) {
                    imageBase64 = resultImageBase64.split(',')[1];
                }
                
                setChatHistory(prev => {
                    const newHistory = [...prev];
                    newHistory[modelResponseIndex] = {
                        role: 'model',
                        parts: [
                            { text: `Đây là ảnh đã chỉnh sửa:` },
                            { inlineData: { data: imageBase64, mimeType: 'image/png' } }
                        ],
                        provider
                    };
                    return newHistory;
                });
            } else if (imageParts.length === 2) {
                // MULTI-IMAGE: Show warning
                setChatHistory(prev => {
                    const newHistory = [...prev];
                    newHistory[modelResponseIndex] = {
                        role: 'model',
                        parts: [{ 
                            text: `⚠️ Multi-image editing detected! Currently only single image editing is supported in Chat mode.\n\nPlease use:\n- **Clone mode** for combining 2 images\n- Or send images one at a time` 
                        }],
                        provider
                    };
                    return newHistory;
                });
            } else {
                throw new Error('Too many images. Maximum 2 images supported.');
            }
            
            return; // Exit early after image editing
        }
        
        // TEXT-ONLY CHAT MODE
        const messages = historySoFar.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.parts.map((p: any) => {
                if ('text' in p) return p.text;
                if ('inlineData' in p) return '[Image]';
                return '';
            }).join(' ')
        }));
        
        const currentText = currentUserParts
            .filter((p: any) => 'text' in p)
            .map((p: any) => p.text)
            .join(' ');
        
        messages.push({ role: 'user', content: currentText });

        // Call Cloud API
        const result = await cloudApiService.chat(messages, 'gemini');
        
        if (!result.success) {
            throw new Error(result.error || 'Chat failed');
        }

        const responseText = result.data?.data || result.data || '';
        
        setChatHistory(prev => {
            const newHistory = [...prev];
            newHistory[modelResponseIndex] = {
                role: 'model',
                parts: [{ text: responseText }],
                provider
            };
            return newHistory;
        });
        
    } catch (error: any) {
        console.error("Gemini chat via Cloud API failed:", error);
        setChatHistory(prev => {
            const newHistory = [...prev];
            newHistory[modelResponseIndex] = {
                role: 'model',
                parts: [{ text: `Sorry, chat failed: ${error.message || 'Unknown error'}` }],
                provider
            };
            return newHistory;
        });
    }
    return;
}
```

### 3. **Clean up old code**

**Xóa các comment code cũ:**
- Lines 712-724: Old Gemini chat creation code
- Lines 730-850: Old hasImage logic

---

## 🎯 Kết quả mong đợi

Sau khi áp dụng:

1. ✅ **Multi-image detection** - Phát hiện chính xác 0, 1, 2+ ảnh
2. ✅ **Clear provider logic** - Tách biệt rõ ràng Gemini vs OpenAI
3. ✅ **Better error handling** - Thông báo lỗi cụ thể và hướng dẫn người dùng
4. ✅ **Intent detection** - Phát hiện đúng generate vs edit vs chat
5. ✅ **User guidance** - Hướng dẫn người dùng khi họ làm sai (ví dụ: gửi 2 ảnh)

---

## 📝 Testing Checklist

- [ ] OpenAI: Text-only chat
- [ ] OpenAI: "generate a cat" → image generation
- [ ] OpenAI: 1 image + text → image edit
- [ ] OpenAI: 2 images → warning message
- [ ] Gemini: Text-only chat
- [ ] Gemini: 1 image + text → image edit
- [ ] Gemini: 2 images → warning message
- [ ] Error handling: Network error
- [ ] Error handling: API limit reached
