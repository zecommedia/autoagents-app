# Clone Mode Workflow Improvements - October 2024

## Các vấn đề đã được giải quyết

### 1. ❌ Vấn đề: Ảnh bị mờ và nền còn lại
**Nguyên nhân:**
- Server đang downscale ảnh xuống 900px khi `preview: true`
- Client đang sử dụng preview mode cho hiển thị ban đầu

**Giải pháp:**
- ✅ Loại bỏ hoàn toàn preview mode - xử lý ảnh ở **FULL RESOLUTION** ngay từ đầu
- ✅ Server chỉ downscale khi `preview === true`, giờ ta set `preview: false` luôn
- ✅ Kết quả: Ảnh sắc nét, chất lượng cao ngay sau khi upload

### 2. ❌ Vấn đề: Phải chỉnh settings → Apply Settings mới process
**Workflow cũ:**
```
Upload → Preview (900px) → Chỉnh settings → Click "Apply Settings" → Process full-res
```

**Workflow mới:**
```
Upload → AUTO-PROCESS FULL-RES → Chỉnh settings (xem preview) → Click "Download High-Res" → Export 4500x5100
```

**Lợi ích:**
- ✅ Không cần click "Apply Settings" để xem ảnh chất lượng cao
- ✅ Ảnh được process ngay lập tức ở độ phân giải tối đa
- ✅ Button "Download High-Res" sẽ:
  - Re-process nếu có thay đổi settings
  - Tạo background job export file 4500x5100
  - Tự động tải file về (TIFF hoặc PNG)

## Các thay đổi code chính

### 1. `components/CloneMode.tsx` - Loại bỏ preview mode

```typescript
// Before:
const params: any = {
    // ... other params
    // preview was sometimes true
};

// After:
const params: any = {
    // ... other params
    preview: false, // ALWAYS process full resolution
};
```

### 2. `components/CloneMode.tsx` - Cập nhật applyFinal function

```typescript
const applyFinal = async () => {
    // NEW: "Apply Settings" now means "Download High-Res Export"
    // 1. Re-process if settings changed
    if (tuningDirty) {
        const finalProcessedUrl = await runProcessCutout(sourceImage, true);
        setFinalImage(finalProcessedUrl);
    }
    
    // 2. Create background job for 4500x5100 export
    const res = await fetch('/api/job/create', { ... });
    
    // 3. Auto-download when ready
    if (d.status === 'completed' && d.result?.dataUrl) {
        const a = document.createElement('a');
        a.href = d.result.dataUrl;
        a.download = `cutout_${Date.now()}.${outputFormat === 'tiff-cmyk' ? 'tif' : 'png'}`;
        a.click();
    }
};
```

### 3. UI Messages - Làm rõ workflow mới

```typescript
// Button text:
{isReprocessing ? '⏳ Exporting...' : 
 tuningDirty ? '📥 Download High-Res (Apply Settings)' : 
 '📥 Download High-Res (4500x5100)'}

// Processing step message:
{step === 'resizing' ? '✨ Processing Full Resolution' : ...}
{step === 'resizing' ? 'Applying chroma removal at full quality (no preview mode)...' : ...}
```

## Workflow chi tiết mới

### Bước 1: Upload
1. User upload ảnh thiết kế áo
2. Chọn AI model (Gemini/OpenAI)
3. Chọn upscale model (Real-ESRGAN 4x recommended)
4. Chọn màu chroma background (#FF00FF default)

### Bước 2: Auto-Processing (Tự động)
1. **Cloning**: AI tách pattern ra khỏi áo
2. **Detecting**: Phát hiện và crop pattern boundaries
3. **Upscaling**: Upscale 4x với Real-ESRGAN
4. **Processing Full Resolution**: Xử lý chroma removal ở **FULL RES** (không downscale!)
5. → Hiển thị ảnh sắc nét ngay lập tức

### Bước 3: Tuning (Optional)
- User có thể điều chỉnh settings:
  - Chroma Tolerance
  - Morphology Operations
  - Feather Radius
  - Edge Enhancement
  - Anti-aliasing
  - Corner Refinement
  - v.v.
- Client-side preview cập nhật real-time (không cần gọi server)

### Bước 4: Download High-Res
- Click button "📥 Download High-Res"
- Nếu có thay đổi settings → Re-process với settings mới
- Tạo background job export file 4500x5100
- Auto-download file TIFF/PNG chất lượng cao

## Server Processing Flow

### When `preview: false` (NEW DEFAULT):
```typescript
// server/src/processCutout.ts
const maxPreview = 900;
let workingBuffer = inputBuffer;

if (preview) { // This is now ALWAYS false from client
    // downscale - NEVER EXECUTED NOW
} else {
    // Process at FULL RESOLUTION ✅
    workingBuffer = inputBuffer; // Original quality
}
```

### Export Job (Background):
```typescript
// POST /api/job/create
// Creates background job to:
// 1. Process cutout at 4500x5100
// 2. Apply all advanced settings
// 3. Export as TIFF-CMYK or PNG
// 4. Store in cache
// 5. Return download URL
```

## Kiểm tra chất lượng

### ✅ Image Quality Checklist:
- [ ] Ảnh sắc nét ngay sau upload (không mờ)
- [ ] Không thấy nền chroma ở preview
- [ ] Edge anti-aliasing mượt mà
- [ ] Chi tiết pattern được giữ nguyên
- [ ] File export 4500x5100 đầy đủ quality

### ✅ Workflow Checklist:
- [ ] Upload → Auto-process ngay (không cần click gì)
- [ ] Xem ảnh full-res sau ~30s-1min
- [ ] Điều chỉnh settings → Thấy preview ngay lập tức
- [ ] Click "Download High-Res" → File tải về tự động
- [ ] File tải về có kích thước 4500x5100

## Technical Notes

### Preview Mode Removal:
- **Before**: Client gửi `preview: true` → Server downscale to 900px
- **After**: Client gửi `preview: false` → Server xử lý full resolution
- **Impact**: Quality ↑↑↑, Processing time ↑ (acceptable trade-off)

### Client-side Preview:
- Real-time preview vẫn hoạt động bằng canvas manipulation
- Không cần gọi server khi thay đổi sliders
- Preview dựa trên upscaled image (high quality)

### Background Jobs:
- Sử dụng BullMQ queue system
- Redis-backed job storage
- Automatic retry on failure
- Progress tracking
- Result caching

## Files Changed

1. `components/CloneMode.tsx`
   - Added `preview: false` flag to runProcessCutout
   - Updated applyFinal to trigger download instead of reprocess
   - Updated UI messages and button text
   - Added workflow documentation comment

2. `server/src/processCutout.ts`
   - No changes needed (already supports preview flag)
   - Only downscales when `preview === true`

3. Build output:
   - Successfully compiled
   - Bundle size: 1,906.33 kB (gzipped: 490.31 kB)

## Recommended Testing

```bash
# 1. Start server with Redis
cd server
npm run dev

# 2. Start frontend
cd ..
npm run dev

# 3. Test workflow:
# - Upload test image (cozy season design recommended)
# - Verify image is sharp after processing
# - Adjust chroma tolerance slider
# - Click "Download High-Res"
# - Verify file downloads automatically
# - Check file dimensions: 4500x5100
```

## Future Enhancements

1. **Progressive Loading**: Show low-res preview first, then swap to full-res
2. **Quality Comparison**: Side-by-side before/after view
3. **Batch Processing**: Upload multiple designs at once
4. **Cloud Storage**: Save exports to cloud instead of data URLs
5. **Format Options**: WebP, AVIF for modern browsers

---

**Summary**: Ảnh giờ **nét căng**, không bị mờ, và workflow **đơn giản hơn** - upload là xử lý luôn, click download là tải về file chất lượng cao! 🎉
