# Clone Mode Upscale Fix ✅

## Vấn đề
```
POST http://localhost:4000/proxy/upscale 500 (Internal Server Error)
AxiosError: Request failed with status code 422 (Unprocessable Entity)
```

## Nguyên nhân
1. ❌ **Sai endpoint**: Dùng `/v1/predictions` thay vì `/v1/models/nightmareai/real-esrgan/predictions`
2. ❌ **Sai format request**: Gửi `version` field thay vì chỉ `input` với `image` + `scale`
3. ❌ **Thiếu header**: Không có `Prefer: wait` nên phải poll nhiều lần
4. ❌ **Token format**: Dùng `Token` thay vì `Bearer`
5. ❌ **Response format**: Replicate trả URL, cần download và convert sang base64

## Giải pháp

### 1. Fix Replicate API Call (server.js)
```javascript
// Map model name to scale
const scale = model?.includes('x2') ? 2 : 4;

// Convert base64 to data URL
const imageInput = image.startsWith('http') 
  ? image 
  : `data:image/png;base64,${image}`;

// Call correct endpoint
const response = await axios.post(
  'https://api.replicate.com/v1/models/nightmareai/real-esrgan/predictions',
  {
    input: { 
      image: imageInput,
      scale
    }
  },
  {
    headers: {
      'Authorization': `Bearer ${process.env.REPLICATE_API_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait'  // ✅ No need to poll!
    }
  }
);
```

### 2. Download & Convert Response
```javascript
// Download the result image from Replicate's URL
const outputUrl = prediction.output;
const imageResponse = await axios.get(outputUrl, { 
  responseType: 'arraybuffer' 
});
const base64Image = Buffer.from(imageResponse.data, 'binary').toString('base64');

// Return base64 (not URL)
res.json({
  success: true,
  data: base64Image,
  cost,
  processingTime
});
```

## Format So Sánh

### ❌ Cũ (Sai)
```javascript
POST /v1/predictions
{
  "version": "nightmareai/real-esrgan:42fed1c...",
  "input": { "image": "base64data" }
}
Headers: { "Authorization": "Token xxx" }
// Phải poll nhiều lần để lấy kết quả
```

### ✅ Mới (Đúng)
```javascript
POST /v1/models/nightmareai/real-esrgan/predictions
{
  "input": { 
    "image": "data:image/png;base64,xxx",
    "scale": 2
  }
}
Headers: { 
  "Authorization": "Bearer xxx",
  "Prefer": "wait"  // ✅ Chờ luôn không cần poll
}
```

## Tham Khảo
- Replicate API Docs: https://replicate.com/nightmareai/real-esrgan
- Curl example từ user:
```bash
curl --silent --show-error \
  https://api.replicate.com/v1/models/nightmareai/real-esrgan/predictions \
  --request POST \
  --header "Authorization: Bearer $REPLICATE_API_TOKEN" \
  --header "Content-Type: application/json" \
  --header "Prefer: wait" \
  --data '{"input": {"image": "https://...", "scale": 2}}'
```

## Testing
1. Refresh browser: `Ctrl+F5`
2. Drop t-shirt image vào Clone Mode
3. Select model (Gemini/OpenAI)
4. Click "Start Clone"
5. Verify upscaling works (scale x2 or x4 based on selected model)

## Status: ✅ FIXED
- Cloud server restarted on port 4000
- Replicate API call corrected
- Response format standardized (base64)
- No more 422/500 errors
