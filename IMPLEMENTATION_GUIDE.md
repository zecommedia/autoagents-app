# 🎯 Chat Mode Implementation Guide

Dựa trên phân tích từ **AutoAgents-Redesign/App.tsx**, đây là hướng dẫn chi tiết để cải tiến Chat Mode trong autoagents-app.

---

## 📊 So sánh Architecture

### **AutoAgents-Redesign** (Tốt hơn)
```
executeChatTurn()
├── OpenAI Path
│   ├── CASE 1: Text-only chat → GPT-4o-mini streaming
│   ├── CASE 2: Image generation → DALL-E 3
│   ├── CASE 3: 1 image edit → DALL-E 2 Edit
│   └── CASE 4: 2+ images → Warning message
│
└── Gemini Path
    ├── IMAGE MODE: 1 or 2 images with text
    │   ├── 1 image → Gemini function call (editImage)
    │   ├── 2 images → Warning message
    │   └── 3+ images → Error
    └── TEXT MODE: No images
        └── Gemini streaming with function calls
```

### **autoagents-app** (Hiện tại - Cần cải tiến)
```
executeChatTurn()
├── OpenAI Path
│   ├── hasImage check (không đếm số ảnh)
│   ├── wantsImageGen check
│   ├── Chat with image_url parts (streaming)
│   └── Không handle multi-image
│
└── Gemini Path
    ├── Sử dụng Cloud API
    ├── Detect ảnh đơn
    └── Chưa handle 2 ảnh cùng lúc
```

---

## 🔧 Các thay đổi cần thực hiện

### **Change 1: Improve image counting (OpenAI)**

**Location**: `src/App.tsx`, function `executeChatTurn`, line ~730

**Current Code**:
```typescript
const hasImage = currentUserParts.some(p => 'inlineData' in p);
const textInPrompt = currentUserParts.filter((p: any) => p.text).map((p: any) => p.text).join(' ').trim();
const wantsImageGen = !hasImage && /\b(generate|create|draw...)\.test(textInPrompt);
```

**New Code**:
```typescript
// Count images properly
const imageParts = currentUserParts.filter(p => 'inlineData' in p);
const textPart = currentUserParts.find(p => 'text' in p);
const textInPrompt = textPart?.text || '';
const wantsImageGen = imageParts.length === 0 && /\b(generate|create|draw|vẽ|tạo ảnh|tao anh|tạo hình|tao hinh|tạo|ve)\b/i.test(textInPrompt);
```

**Benefit**: Biết chính xác có bao nhiêu ảnh (0, 1, 2, 3+)

---

### **Change 2: Add multi-image warning (OpenAI)**

**Location**: Sau phần xử lý single image edit trong OpenAI path

**Add this code BEFORE the text-only chat streaming logic**:
```typescript
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
```

---

### **Change 3: Improve Gemini image handling**

**Location**: `src/App.tsx`, function `executeChatTurn`, Gemini path (~line 850)

**Current flow**:
```typescript
if (provider === 'gemini') {
    try {
        // Check if user sent images + text
        const imageParts = currentUserParts.filter(p => 'inlineData' in p);
        const textPart = currentUserParts.find(p => 'text' in p);
        
        if (imageParts.length > 0 && textPart) {
            // Single image edit
            ...
        }
        
        // Text-only chat
        ...
    }
}
```

**Improved flow**:
```typescript
if (provider === 'gemini') {
    try {
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
        
        // TEXT-ONLY CHAT MODE continues...
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

---

## 📋 Step-by-Step Implementation

### Step 1: Backup current file
```bash
cp src/App.tsx src/App.tsx.backup
```

### Step 2: Apply Change 1 (Image counting)
Tìm dòng:
```typescript
const hasImage = currentUserParts.some(p => 'inlineData' in p);
```

Thay thế bằng:
```typescript
const imageParts = currentUserParts.filter(p => 'inlineData' in p);
const textPart = currentUserParts.find(p => 'text' in p);
const textInPrompt = textPart?.text || '';
const wantsImageGen = imageParts.length === 0 && /\b(generate|create|draw|vẽ|tạo ảnh|tao anh|tạo hình|tao hinh|tạo|ve)\b/i.test(textInPrompt);
```

Update all references:
- `hasImage` → `imageParts.length > 0`
- `imageUrls` → use `imageParts` directly

### Step 3: Apply Change 2 (Multi-image warning for OpenAI)
Tìm phần xử lý OpenAI image edit, sau đó thêm case 4.

### Step 4: Apply Change 3 (Gemini improvements)
Cập nhật phần Gemini path như code ở trên.

### Step 5: Test
```bash
npm run dev
```

Test cases:
1. ✅ OpenAI: Text-only
2. ✅ OpenAI: "generate a cat"
3. ✅ OpenAI: 1 image + text
4. ✅ OpenAI: 2 images → warning
5. ✅ Gemini: Text-only
6. ✅ Gemini: 1 image + text
7. ✅ Gemini: 2 images → warning

---

## 🎯 Expected Results

### Before (Current)
- ❌ Không phát hiện được 2 ảnh
- ❌ Người dùng confuse khi gửi 2 ảnh
- ❌ Không có hướng dẫn rõ ràng

### After (Improved)
- ✅ Phát hiện chính xác số lượng ảnh
- ✅ Hiển thị warning message hữu ích
- ✅ Hướng dẫn người dùng sử dụng Clone mode
- ✅ Code rõ ràng, dễ maintain
- ✅ Consistent với AutoAgents-Redesign

---

## 📚 References

- **AutoAgents-Redesign/App.tsx**: Lines 596-880 (executeChatTurn function)
- **Key patterns**: Multi-image detection, provider separation, user guidance
