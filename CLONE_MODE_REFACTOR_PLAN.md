# 🎨 CLONE MODE REFACTOR - DETAILED IMPLEMENTATION PLAN

## 📋 Overview
Refactor Clone Mode từ AutoAgents-Redesign sang autoagents-app, migration hoàn toàn với tất cả features và optimizations.

---

## 🔍 PHASE 1: ANALYSIS - SO SÁNH 2 VERSIONS

### **AutoAgents-Redesign Clone Mode** (SOURCE - Feature Complete)

#### 1. **Pattern Extraction với Gemini/OpenAI**
```typescript
// File: prompts.ts - getCloneDesignPrompt()
- ✅ Chọn màu chroma background tùy chỉnh (#FF00FF default)
- ✅ Prompt chi tiết với color naming (magenta, green, cyan, etc.)
- ✅ Auto-rotate & straighten design
- ✅ Isolation từ fabric texture
- ✅ High-quality redraw
- ✅ Distinct chroma background
- ✅ Clean edges for chroma-keying
```

**Prompt Structure:**
```typescript
export const getCloneDesignPrompt = (options?: { chromaHex?: string }) => {
    const chroma = (options?.chromaHex?.trim() || '#FF00FF').toUpperCase();
    const chromaName = colorNameFromHex(chroma); // "magenta", "green", etc.
    return `Your task is to extract the graphical pattern...
    4. DISTINCT CHROMA BACKGROUND: Use exact solid '${chromaName}' ('${chroma}')
    ...`;
};
```

#### 2. **Chroma Key Selection System**
```typescript
// State management
const [chromaMode, setChromaMode] = useState<'auto'|'magenta'|'green'|'custom'>('auto');
const [customChroma, setCustomChroma] = useState<{r:number,g:number,b:number}>({r:255,g:0,b:255});
const [promptChromaHex, setPromptChromaHex] = useState<string>('#FF00FF');
const [pickedChroma, setPickedChroma] = useState<{r:number,g:number,b:number}|null>(null);
const [isPickingChroma, setIsPickingChroma] = useState<boolean>(false);

// UI Controls
- Radio buttons: Auto / Magenta / Green / Custom
- Color picker input for custom hex
- Eyedropper tool để pick màu từ image
- Sync prompt chroma với cutout chroma
```

#### 3. **Upscaling với Replicate API**
```typescript
// File: replicateService.ts
export const upscaleImage = async (imageUrl: string, model?: string): Promise<string> => {
    const response = await fetch('/api/upscale', {
        method: 'POST',
        body: JSON.stringify({ 
            imageUrl,
            model: model || 'realesrgan-x4plus' // default
        }),
    });
    // Returns upscaled data URL
};

// Models available:
- realesrgan-x4plus (default - best quality/speed balance)
- realesrgan-x2plus (2x scale)
- realesrgan-x4plus-anime (anime/illustration optimized)
```

**Model Selection:**
```typescript
const [selectedUpscaleModel, setSelectedUpscaleModel] = useState<string>('realesrgan-x4plus');
const [showModelSelection, setShowModelSelection] = useState<boolean>(false);

// Modal UI before processing
<Modal>
  <Select value={selectedUpscaleModel} onChange={...}>
    <option value="realesrgan-x4plus">RealESRGAN 4x (Default)</option>
    <option value="realesrgan-x2plus">RealESRGAN 2x (Faster)</option>
    <option value="realesrgan-x4plus-anime">RealESRGAN 4x Anime</option>
  </Select>
</Modal>
```

#### 4. **Chroma Key Processing (Local Server)**
```typescript
// File: services/imageProcessing.ts
export const processCutout = async (
    imageDataUrlOrUrl: string, 
    opts?: { 
        chroma?: { r: number; g: number; b: number }; 
        tolerance?: number; 
        morph?: { op: 'dilate'|'erode'; iter: number }; 
        feather?: number; 
        ssaaQuality?: number;
        decontamination?: number;
        edgeChoke?: number;
        cornerSmoothing?: number;
        cornerRefinement?: number;
        // ... 20+ advanced options
    },
    signal?: AbortSignal
) => {
    const resp = await fetch('/api/process-cutout', {
        method: 'POST',
        body: JSON.stringify(body),
        signal,
    });
    return data.dataUrl as string;
};
```

**Advanced Controls (Local Server Processing):**
- ✅ Chroma tolerance (0-100)
- ✅ Morphology operations (dilate/erode)
- ✅ Feather radius
- ✅ SSAA Quality (supersampling anti-aliasing)
- ✅ Decontamination (color fringe removal)
- ✅ Edge Choke (expand/contract edges)
- ✅ Corner Smoothing
- ✅ Corner Refinement
- ✅ Border Cleanup
- ✅ Contrast Enhancement
- ✅ Artifact Cleanup Size

#### 5. **Client-Side Real-Time Preview**
```typescript
// PHOTOSHOP-STYLE instant feedback
// Web Worker for off-thread processing
const workerRef = useRef<Worker | null>(null);

// Smart caching strategy
const [cachedBaseMask, setCachedBaseMask] = useState<string | null>(null);
const [heavyParams, setHeavyParams] = useState<string>('');

// All params are "light" - process instantly on client
const currentLightParams = useMemo(() =>
    `${chromaTolerance}-${morphOp}-${morphIter}-${featherRadius}-${edgeChoke}-...`,
    [chromaTolerance, morphOp, ...]
);

// Real-time preview (400ms debounce)
useEffect(() => {
    const timeoutId = setTimeout(() => {
        applyClientSideRefinement(); // Web Worker processing
    }, 400);
    return () => clearTimeout(timeoutId);
}, [currentLightParams]);
```

#### 6. **Drawing Tools (Pen & Brush)**
```typescript
// Adobe Illustrator-style pen tool
const [isPenErasing, setIsPenErasing] = useState<boolean>(false);
const [penPoints, setPenPoints] = useState<Array<{
    x: number; 
    y: number; 
    cp1?: {x:number, y:number}; // Bezier control point 1
    cp2?: {x:number, y:number}; // Bezier control point 2
    type: 'smooth' | 'corner';
}>>([]);

// Brush/Eraser tool
const [activeTool, setActiveTool] = useState<'pen' | 'brush' | 'eraser' | null>(null);
const [brushSize, setBrushSize] = useState<number>(20);
const [brushStrokes, setBrushStrokes] = useState<Array<{
    type: 'brush' | 'eraser';
    points: Array<{x: number, y: number}>;
    size: number;
}>>([]);

// Apply tools to image (send to server)
const applyPenEraser = async () => {
    await fetch('/api/apply-pen-erase', {
        body: JSON.stringify({ polygon: penPoints, imageUrl })
    });
};
```

#### 7. **Undo/Redo System**
```typescript
const [undoHistory, setUndoHistory] = useState<string[]>([]);
const [redoHistory, setRedoHistory] = useState<string[]>([]);

// Keyboard shortcuts
useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === 'z') undo();
        if (e.ctrlKey && e.shiftKey && e.key === 'z') redo();
        if (e.ctrlKey && e.key === 'y') redo();
    };
    window.addEventListener('keydown', handleKeyDown);
}, [undo, redo]);
```

#### 8. **Preview Background Options**
```typescript
const [previewBgMode, setPreviewBgMode] = useState<'checker'|'green'|'custom'>('checker');
const [previewBgColor, setPreviewBgColor] = useState<string>('#ffffff');
const [previewBgOpacity, setPreviewBgOpacity] = useState<number>(0.9);

// Computed CSS style
const panelBgStyle = useMemo(() => {
    if (previewBgMode === 'checker') {
        return { backgroundImage: 'linear-gradient(45deg,#6b6b6b 25%,...)' };
    }
    if (previewBgMode === 'green') {
        return { backgroundColor: `rgba(0, 255, 0, ${previewBgOpacity})` };
    }
    // Custom color mode
    const rgb = hexToRgb(previewBgColor);
    return { backgroundColor: `rgba(${rgb.r},${rgb.g},${rgb.b},${previewBgOpacity})` };
}, [previewBgMode, previewBgColor, previewBgOpacity]);
```

#### 9. **Auto-Detect & Crop Pattern**
```typescript
// Detect pattern boundaries and crop to maximize design
const detectAndCropPattern = async (imageDataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            // Sample edge colors to find non-chroma region
            // Crop to tight bounding box
            // Return cropped dataURL
        };
        img.src = imageDataUrl;
    });
};
```

#### 10. **Workflow Steps**
```typescript
type Step = 'upload' | 'cloning' | 'detecting' | 'upscaling' | 'resizing' | 'done';

// Step 1: Upload → Show model selection modal
// Step 2: Cloning → Call Gemini/OpenAI with getCloneDesignPrompt()
// Step 3: Detecting → Auto-detect chroma from result
// Step 4: Upscaling → Call Replicate API
// Step 5: Resizing → Resize to target dimensions with chroma cleanup
// Step 6: Done → Show result with tuning controls
```

---

### **autoagents-app Clone Mode** (TARGET - Needs Update)

#### Current State:
```typescript
// ❌ Chỉ có basic upscale qua cloudApiService
// ❌ Không có chroma selection UI
// ❌ Không có prompt customization với màu chroma
// ❌ Không có pen/brush tools
// ❌ Không có undo/redo
// ❌ Không có preview background options
// ❌ Không có auto-detect & crop
// ❌ Không có model selection modal
```

---

## 🎯 PHASE 2: MIGRATION STRATEGY

### A. **Files to Create/Update**

#### 1. **Prompts (src/prompts.ts)**
```typescript
// ✅ CÓ SẴN - Chỉ cần verify
export const getCloneDesignPrompt = (options?: { chromaHex?: string }) => {
    // Already exists with full implementation
};

// ✅ ADD colorNameFromHex helper
function colorNameFromHex(hex: string): string {
    // Convert hex to friendly color name
};
```

#### 2. **Services to Add/Update**

**a) Cloud API Service Enhancement**
```typescript
// File: lib/services/cloudApiService.ts

// ✅ THÊM: Upscale method với Replicate
export const upscale = async (
    image: File | string, 
    scale: number = 4,
    model: string = 'realesrgan-x4plus'
): Promise<ApiResponse> => {
    const formData = new FormData();
    if (typeof image === 'string') {
        formData.append('imageUrl', image);
    } else {
        formData.append('image', image);
    }
    formData.append('scale', scale.toString());
    formData.append('model', model);
    
    const response = await fetch(`${API_BASE_URL}/upscale`, {
        method: 'POST',
        body: formData,
    });
    
    return await response.json();
};

// ✅ THÊM: Apply drawing tools (pen/brush)
export const applyDrawingTools = async (
    imageUrl: string,
    polygons?: Array<any>,
    strokes?: Array<any>
): Promise<ApiResponse> => {
    const response = await fetch(`${API_BASE_URL}/apply-drawing`, {
        method: 'POST',
        body: JSON.stringify({ imageUrl, polygons, strokes }),
    });
    return await response.json();
};
```

**b) Local Image Processing (Keep as-is)**
```typescript
// File: src/services/imageProcessing.ts
// ✅ GIỮ NGUYÊN - Local processing cho chroma key
export const processCutout = async (...) => {
    // KHÔNG THAY ĐỔI - Đã có đầy đủ advanced options
};
```

#### 3. **Component Updates**

**File: src/components/CloneMode.tsx**

**Changes Required:**

**a) State Management** ✅
```typescript
// ✅ ADD: Chroma selection
const [chromaMode, setChromaMode] = useState<'auto'|'magenta'|'green'|'custom'>('auto');
const [promptChromaHex, setPromptChromaHex] = useState<string>('#FF00FF');
const [customChroma, setCustomChroma] = useState<{r:number,g:number,b:number}>({r:255,g:0,b:255});
const [pickedChroma, setPickedChroma] = useState<{r:number,g:number,b:number}|null>(null);
const [isPickingChroma, setIsPickingChroma] = useState<boolean>(false);

// ✅ ADD: Model selection
const [showModelSelection, setShowModelSelection] = useState<boolean>(false);
const [selectedUpscaleModel, setSelectedUpscaleModel] = useState<string>('realesrgan-x4plus');
const [selectedPatternModel, setSelectedPatternModel] = useState<'gemini' | 'openai'>('gemini');

// ✅ ADD: Drawing tools
const [activeTool, setActiveTool] = useState<'pen' | 'brush' | 'eraser' | null>(null);
const [isPenErasing, setIsPenErasing] = useState<boolean>(false);
const [penPoints, setPenPoints] = useState<Array<PenPoint>>([]);
const [brushStrokes, setBrushStrokes] = useState<Array<BrushStroke>>([]);

// ✅ ADD: Undo/Redo
const [undoHistory, setUndoHistory] = useState<string[]>([]);
const [redoHistory, setRedoHistory] = useState<string[]>([]);

// ✅ ADD: Preview background
const [previewBgMode, setPreviewBgMode] = useState<'checker'|'green'|'custom'>('checker');
const [previewBgColor, setPreviewBgColor] = useState<string>('#ffffff');
const [previewBgOpacity, setPreviewBgOpacity] = useState<number>(0.9);
```

**b) Pattern Extraction** 🔄 REFACTOR
```typescript
// BEFORE (autoagents-app):
const handleFile = async (file: File) => {
    // Simple call to generateImageViaCloudApi()
};

// AFTER (với chroma selection):
const handleFile = (file: File) => {
    setPendingFile(file);
    setShowModelSelection(true); // Show modal FIRST
};

const startProcessing = async () => {
    if (!pendingFile) return;
    setShowModelSelection(false);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        setOriginalImage(dataUrl);
        setStep('cloning');
        
        try {
            // Call with CUSTOM CHROMA
            const prompt = getCloneDesignPrompt({ chromaHex: promptChromaHex });
            
            let resultImageBase64: string;
            if (selectedPatternModel === 'gemini') {
                // Use Cloud API Gemini
                resultImageBase64 = await generateImageViaCloudApi(
                    dataUrl, 
                    prompt, 
                    'redesign', 
                    'gemini'
                );
            } else {
                // Use Cloud API OpenAI
                resultImageBase64 = await generateImageViaCloudApi(
                    dataUrl, 
                    prompt, 
                    'redesign', 
                    'openai'
                );
            }
            
            setClonedImage(resultImageBase64);
            setStep('upscaling');
            
            // Upscale with selected model
            const upscaled = await cloudApiService.upscale(
                resultImageBase64, 
                4, 
                selectedUpscaleModel
            );
            
            setUpscaledImage(upscaled.data);
            setStep('done');
            
        } catch (error) {
            console.error('Clone failed:', error);
        }
    };
    reader.readAsDataURL(pendingFile);
};
```

**c) Chroma Selection UI** ✅ NEW
```tsx
{/* Model Selection Modal */}
{showModelSelection && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3>Select Processing Options</h3>
            
            {/* Pattern Extraction Model */}
            <div className="mb-4">
                <label>AI Model for Pattern Extraction:</label>
                <select value={selectedPatternModel} onChange={...}>
                    <option value="gemini">Gemini (Faster)</option>
                    <option value="openai">OpenAI (Higher Quality)</option>
                </select>
            </div>
            
            {/* Chroma Background Color */}
            <div className="mb-4">
                <label>Background Chroma Color:</label>
                <div className="flex items-center gap-2">
                    <input 
                        type="color" 
                        value={promptChromaHex} 
                        onChange={(e) => setPromptChromaHex(e.target.value)}
                    />
                    <input 
                        type="text" 
                        value={promptChromaHex} 
                        onChange={(e) => setPromptChromaHex(e.target.value)}
                        className="font-mono"
                    />
                </div>
                <p className="text-sm text-gray-500">
                    Default: #FF00FF (Magenta) - Choose a color unlikely to appear in your design
                </p>
            </div>
            
            {/* Upscale Model */}
            <div className="mb-4">
                <label>Upscale Model:</label>
                <select value={selectedUpscaleModel} onChange={...}>
                    <option value="realesrgan-x4plus">RealESRGAN 4x (Default)</option>
                    <option value="realesrgan-x2plus">RealESRGAN 2x (Faster)</option>
                    <option value="realesrgan-x4plus-anime">RealESRGAN 4x Anime</option>
                </select>
            </div>
            
            <div className="flex gap-2">
                <button onClick={startProcessing}>Start Processing</button>
                <button onClick={() => setShowModelSelection(false)}>Cancel</button>
            </div>
        </div>
    </div>
)}
```

**d) Chroma Cutout Controls** ✅ UPDATE
```tsx
{/* Chroma Mode Selection */}
<div className="mb-4">
    <label>Chroma Detection Mode:</label>
    <div className="flex gap-2">
        <label>
            <input 
                type="radio" 
                checked={chromaMode === 'auto'} 
                onChange={() => setChromaMode('auto')}
            />
            Auto-Detect
        </label>
        <label>
            <input 
                type="radio" 
                checked={chromaMode === 'magenta'} 
                onChange={() => setChromaMode('magenta')}
            />
            Magenta
        </label>
        <label>
            <input 
                type="radio" 
                checked={chromaMode === 'green'} 
                onChange={() => setChromaMode('green')}
            />
            Green
        </label>
        <label>
            <input 
                type="radio" 
                checked={chromaMode === 'custom'} 
                onChange={() => setChromaMode('custom')}
            />
            Custom
        </label>
    </div>
    
    {chromaMode === 'custom' && (
        <div className="mt-2 flex items-center gap-2">
            <input 
                type="color" 
                value={rgbToHex(customChroma)} 
                onChange={(e) => {
                    const rgb = hexToRgb(e.target.value);
                    if (rgb) setCustomChroma(rgb);
                }}
            />
            <button onClick={() => setIsPickingChroma(true)}>
                👁️ Pick from Image
            </button>
            {isPickingChroma && <span>Click on image to pick color</span>}
        </div>
    )}
</div>

{/* Preview Background */}
<div className="mb-4">
    <label>Preview Background:</label>
    <div className="flex gap-2">
        <button onClick={() => setPreviewBgMode('checker')}>Checkerboard</button>
        <button onClick={() => setPreviewBgMode('green')}>Green</button>
        <button onClick={() => setPreviewBgMode('custom')}>Custom</button>
    </div>
    {previewBgMode === 'custom' && (
        <input 
            type="color" 
            value={previewBgColor} 
            onChange={(e) => setPreviewBgColor(e.target.value)}
        />
    )}
    <input 
        type="range" 
        min="0" 
        max="1" 
        step="0.1" 
        value={previewBgOpacity} 
        onChange={(e) => setPreviewBgOpacity(parseFloat(e.target.value))}
    />
</div>
```

**e) Drawing Tools UI** ✅ NEW
```tsx
{/* Drawing Tools Toolbar */}
{step === 'done' && (
    <div className="flex gap-2 mb-4">
        <button 
            onClick={() => setActiveTool(activeTool === 'pen' ? null : 'pen')}
            className={activeTool === 'pen' ? 'active' : ''}
        >
            🖊️ Pen Tool
        </button>
        <button 
            onClick={() => setActiveTool(activeTool === 'brush' ? null : 'brush')}
            className={activeTool === 'brush' ? 'active' : ''}
        >
            🖌️ Brush
        </button>
        <button 
            onClick={() => setActiveTool(activeTool === 'eraser' ? null : 'eraser')}
            className={activeTool === 'eraser' ? 'active' : ''}
        >
            🧹 Eraser
        </button>
        
        {activeTool && (
            <>
                <input 
                    type="range" 
                    min="5" 
                    max="100" 
                    value={brushSize} 
                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                />
                <span>Size: {brushSize}px</span>
            </>
        )}
        
        {/* Undo/Redo */}
        <button onClick={undo} disabled={undoHistory.length === 0}>
            ↶ Undo
        </button>
        <button onClick={redo} disabled={redoHistory.length === 0}>
            ↷ Redo
        </button>
    </div>
)}
```

**f) Helpers to Add** ✅
```typescript
// Convert RGB to Hex
const rgbToHex = (rgb: {r:number,g:number,b:number}): string => {
    return '#' + [rgb.r, rgb.g, rgb.b]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
};

// Convert Hex to RGB
const hexToRgb = (hex: string): {r:number,g:number,b:number} | null => {
    let h = hex.trim().replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16)
    };
};

// Detect chroma from image corners
const detectChromaFromImage = async (url: string): Promise<{r:number,g:number,b:number}> => {
    // Sample image corners to find dominant background color
    // Return RGB values
};
```

---

## 🛠️ PHASE 3: CLOUD SERVER UPDATES

### Cloud API Server Endpoints to Add/Update

**File: cloud-api-server/server.js**

#### 1. **Upscale Endpoint (NEW)**
```javascript
// POST /api/redesign/upscale
app.post('/api/redesign/upscale', upload.single('image'), async (req, res) => {
    try {
        const { model = 'realesrgan-x4plus', scale = 4 } = req.body;
        const imageUrl = req.body.imageUrl || req.file.path;
        
        // Call Replicate API
        const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
        
        const output = await replicate.run(
            "nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
            {
                input: {
                    image: imageUrl,
                    scale: scale,
                    face_enhance: false
                }
            }
        );
        
        // Download result and convert to base64
        const response = await fetch(output);
        const buffer = await response.buffer();
        const base64 = buffer.toString('base64');
        
        res.json({
            success: true,
            data: {
                image: base64,
                dataUrl: `data:image/png;base64,${base64}`
            }
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});
```

#### 2. **Apply Drawing Tools Endpoint (NEW)**
```javascript
// POST /api/redesign/apply-drawing
app.post('/api/redesign/apply-drawing', async (req, res) => {
    try {
        const { imageUrl, polygons, strokes } = req.body;
        
        // Load image with Sharp
        const imageBuffer = await loadImageFromUrl(imageUrl);
        let image = sharp(imageBuffer);
        
        // Apply polygon erases (pen tool)
        if (polygons && polygons.length > 0) {
            for (const polygon of polygons) {
                // Create SVG mask from polygon points
                const svg = createPolygonMask(polygon.points);
                // Apply mask to erase
                image = image.composite([{
                    input: Buffer.from(svg),
                    blend: 'dest-out'
                }]);
            }
        }
        
        // Apply brush strokes
        if (strokes && strokes.length > 0) {
            for (const stroke of strokes) {
                // Rasterize stroke path
                const strokeSvg = createStrokeMask(stroke);
                image = image.composite([{
                    input: Buffer.from(strokeSvg),
                    blend: stroke.type === 'eraser' ? 'dest-out' : 'over'
                }]);
            }
        }
        
        const resultBuffer = await image.png().toBuffer();
        const base64 = resultBuffer.toString('base64');
        
        res.json({
            success: true,
            data: {
                image: base64,
                dataUrl: `data:image/png;base64,${base64}`
            }
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});
```

#### 3. **Package.json Dependencies**
```json
{
  "dependencies": {
    "replicate": "^0.32.0",
    "sharp": "^0.33.0"
  }
}
```

---

## 📝 PHASE 4: TESTING CHECKLIST

### Functional Testing

#### Pattern Extraction:
- [ ] Upload image → Show model selection modal
- [ ] Select Gemini model → Pattern extracted correctly
- [ ] Select OpenAI model → Pattern extracted correctly
- [ ] Custom chroma color (#00FF00 green) → AI uses green background
- [ ] Custom chroma color (#FF00FF magenta) → AI uses magenta background
- [ ] Pattern is auto-rotated and straightened

#### Upscaling:
- [ ] RealESRGAN 4x model → Image upscaled 4x
- [ ] RealESRGAN 2x model → Image upscaled 2x  
- [ ] RealESRGAN Anime model → Anime-style upscaling works
- [ ] Upscaled image maintains transparency

#### Chroma Key:
- [ ] Auto-detect mode → Detects chroma from image corners
- [ ] Magenta mode → Uses magenta as chroma key
- [ ] Green mode → Uses green as chroma key
- [ ] Custom mode → Color picker works
- [ ] Custom mode → Eyedropper tool picks color from image
- [ ] Tolerance slider → Changes mask edge
- [ ] Real-time preview updates < 500ms

#### Drawing Tools:
- [ ] Pen tool → Can draw Bezier curves
- [ ] Pen tool → Can create closed path
- [ ] Pen tool → Apply erases transparent area
- [ ] Brush tool → Can paint strokes
- [ ] Eraser tool → Can erase areas
- [ ] Brush size slider works
- [ ] Undo (Ctrl+Z) → Reverts last action
- [ ] Redo (Ctrl+Shift+Z) → Re-applies action

#### Preview:
- [ ] Checkerboard background → Shows transparency
- [ ] Green background → Shows green backdrop
- [ ] Custom background → Shows custom color
- [ ] Opacity slider → Changes background opacity

#### Performance:
- [ ] Client-side preview renders < 500ms
- [ ] Web Worker doesn't block UI
- [ ] Large images (4000x4000) process smoothly

---

## 🚀 PHASE 5: IMPLEMENTATION ORDER

### Step 1: Prompts & Helpers (30 mins)
1. ✅ Verify `getCloneDesignPrompt()` exists in `src/prompts.ts`
2. ✅ Add `colorNameFromHex()` helper function
3. ✅ Add `hexToRgb()` and `rgbToHex()` helper functions

### Step 2: Cloud API Service (1 hour)
1. Add `upscale()` method to `cloudApiService.ts`
2. Add `applyDrawingTools()` method
3. Test endpoints with Postman

### Step 3: Clone Mode State (1 hour)
1. Add all new state variables to CloneMode component
2. Add modal state management
3. Add drawing tools state
4. Add undo/redo state

### Step 4: Model Selection Modal (1 hour)
1. Create modal UI component
2. Wire up model selection
3. Wire up chroma color picker
4. Test modal flow

### Step 5: Upscaling Integration (1 hour)
1. Update `startProcessing()` to call `cloudApiService.upscale()`
2. Pass selected model to API
3. Handle loading states
4. Test with all 3 models

### Step 6: Chroma Selection UI (2 hours)
1. Add radio buttons for chroma modes
2. Add custom color picker
3. Implement eyedropper tool
4. Update `detectChromaFromImage()`
5. Sync with preview

### Step 7: Drawing Tools (3 hours)
1. Add toolbar UI
2. Implement pen tool event handlers
3. Implement brush/eraser handlers
4. Add canvas overlay rendering
5. Implement `applyPenEraser()` and `applyBrushStrokes()`

### Step 8: Undo/Redo (1 hour)
1. Implement history management
2. Add keyboard shortcuts
3. Update UI buttons

### Step 9: Preview Background (30 mins)
1. Add background mode selector
2. Implement `panelBgStyle` calculation
3. Test all modes

### Step 10: Cloud Server Endpoints (2 hours)
1. Add `/api/redesign/upscale` endpoint
2. Add `/api/redesign/apply-drawing` endpoint
3. Install Replicate SDK
4. Test endpoints

### Step 11: Integration Testing (2 hours)
1. Test full workflow end-to-end
2. Test all edge cases
3. Performance optimization
4. Bug fixes

**TOTAL TIME ESTIMATE: ~15 hours**

---

## 📊 SUMMARY OF CHANGES

### Files to Create:
- None (all files exist)

### Files to Update:
1. `src/prompts.ts` - Add color helpers
2. `lib/services/cloudApiService.ts` - Add upscale & drawing methods
3. `src/components/CloneMode.tsx` - Major refactor (80% of work)
4. `cloud-api-server/server.js` - Add 2 new endpoints
5. `cloud-api-server/package.json` - Add Replicate dependency

### Architecture:
```
┌─────────────────────────────────────────┐
│         AUTOAGENTS-APP (Frontend)       │
├─────────────────────────────────────────┤
│                                         │
│  📤 Upload Image                        │
│  ↓                                      │
│  🎨 Model Selection Modal               │
│  - Select AI model (Gemini/OpenAI)     │
│  - Choose chroma color (#FF00FF)       │
│  - Pick upscale model (RealESRGAN 4x)  │
│  ↓                                      │
│  🧠 Pattern Extraction (Cloud API)      │
│  - Call /api/redesign with prompt      │
│  - Prompt includes chroma color         │
│  ↓                                      │
│  ⬆️ Upscale (Cloud API + Replicate)     │
│  - Call /api/redesign/upscale           │
│  - RealESRGAN processes image           │
│  ↓                                      │
│  ✂️ Chroma Key (Local Server)           │
│  - Call /api/process-cutout (local)    │
│  - Client-side real-time preview       │
│  - Web Worker for non-blocking         │
│  ↓                                      │
│  🖌️ Drawing Tools (Optional)            │
│  - Pen tool (Bezier curves)            │
│  - Brush/Eraser                         │
│  - Apply via /api/apply-drawing         │
│  ↓                                      │
│  💾 Download Final Result               │
│                                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│      CLOUD API SERVER (Backend)         │
├─────────────────────────────────────────┤
│                                         │
│  /api/redesign (Gemini/OpenAI)          │
│  - Pattern extraction                   │
│  - Uses getCloneDesignPrompt()          │
│                                         │
│  /api/redesign/upscale (NEW)            │
│  - Calls Replicate API                  │
│  - RealESRGAN models                    │
│                                         │
│  /api/redesign/apply-drawing (NEW)      │
│  - Applies pen/brush edits              │
│  - Uses Sharp for compositing           │
│                                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│       LOCAL SERVER (Electron)           │
├─────────────────────────────────────────┤
│                                         │
│  /api/process-cutout                    │
│  - Chroma key processing                │
│  - Advanced edge refinement             │
│  - Already has all features             │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔑 KEY DECISIONS

### 1. **Pattern Extraction: Cloud API ✅**
- Gemini 2.0 Flash Image
- OpenAI DALL-E 3
- Custom chroma prompt

### 2. **Upscaling: Cloud API + Replicate ✅**
- RealESRGAN via Replicate API
- Model selection before processing
- Return base64 data URL

### 3. **Chroma Key: Local Server ✅**
- Keep existing `/api/process-cutout`
- Already has all advanced features
- Client-side Web Worker for preview

### 4. **Drawing Tools: Cloud API ✅**
- New endpoint `/api/apply-drawing`
- Sharp for image compositing
- Support pen paths & brush strokes

### 5. **UI/UX: Full Feature Parity ✅**
- Model selection modal
- Chroma color picker
- Drawing tools toolbar
- Undo/Redo
- Preview backgrounds

---

## ✅ SUCCESS CRITERIA

1. ✅ Upload image → Show model selection modal
2. ✅ Pattern extraction works with custom chroma
3. ✅ Upscaling via Replicate API (3 models)
4. ✅ Chroma key with 4 modes (auto/magenta/green/custom)
5. ✅ Real-time preview < 500ms
6. ✅ Pen tool draws Bezier curves
7. ✅ Brush/Eraser tools work
8. ✅ Undo/Redo with Ctrl+Z shortcuts
9. ✅ Preview backgrounds (checker/green/custom)
10. ✅ Full workflow takes < 60 seconds

---

**🎯 READY TO IMPLEMENT! Let's start with Step 1.**
