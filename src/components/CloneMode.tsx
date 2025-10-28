import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Wand2, ArrowRight, Scaling } from 'lucide-react';
import ZoomableImage from './ZoomableImage';
import { generateImageFromParts, dataUrlToPart } from '../services/geminiService';
import { generateImageOpenAI } from '../services/openAIService.ts';
import { cloudApiService } from '../../lib/services/cloudApiService';
import { processCutout, makeCacheKey, createFinalJob, getJob } from '../services/imageProcessing';
import { getCloneDesignPrompt } from '../prompts';
import { getCursorStyle } from '../config/cursors';
import './PenTool.css';

const resizeImage = (imageUrl: string, targetW: number, targetH: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            try {
                const srcW = img.naturalWidth;
                const srcH = img.naturalHeight;

                // Helper to sample average color in a small box
                const sampleAverage = (ctx: CanvasRenderingContext2D, x: number, y: number, w = 3, h = 3) => {
                    const data = ctx.getImageData(Math.max(0, x), Math.max(0, y), Math.min(w, ctx.canvas.width - x), Math.min(h, ctx.canvas.height - y)).data;
                    let r = 0, g = 0, b = 0, a = 0, count = 0;
                    for (let i = 0; i < data.length; i += 4) {
                        r += data[i]; g += data[i + 1]; b += data[i + 2]; a += data[i + 3]; count++;
                    }
                    if (count === 0) return { r: 0, g: 0, b: 0, a: 0 };
                    return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count), a: Math.round(a / count) };
                };

                // Create a temp canvas at source size to inspect corner colors
                const srcCanvas = document.createElement('canvas');
                srcCanvas.width = srcW;
                srcCanvas.height = srcH;
                const srcCtx = srcCanvas.getContext('2d');
                if (!srcCtx) return reject(new Error('Failed to get canvas context'));
                srcCtx.drawImage(img, 0, 0);

                // Sample corners
                const corners = [
                    sampleAverage(srcCtx, 1, 1),
                    sampleAverage(srcCtx, Math.max(0, srcW - 4), 1),
                    sampleAverage(srcCtx, 1, Math.max(0, srcH - 4)),
                    sampleAverage(srcCtx, Math.max(0, srcW - 4), Math.max(0, srcH - 4)),
                ];

                // Choose the most opaque corner color as background candidate
                const pick = corners.reduce((best, cur) => (cur.a > best.a ? cur : best), corners[0]);

                // Target chroma we asked the AI to use
                const chroma = { r: 255, g: 0, b: 255 };
                const colorDistance = (c1: any, c2: any) => Math.sqrt((c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2);
                const tolerance = 60; // allow some leeway
                const isChroma = colorDistance(pick, chroma) <= tolerance;

                // Compute scaled size preserving aspect ratio
                const scale = Math.min(targetW / srcW, targetH / srcH);
                const drawW = Math.round(srcW * scale);
                const drawH = Math.round(srcH * scale);
                const offsetX = Math.round((targetW - drawW) / 2);
                const offsetY = Math.round((targetH - drawH) / 2);

                // Final canvas
                const canvas = document.createElement('canvas');
                canvas.width = targetW;
                canvas.height = targetH;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Failed to get canvas context'));

                // Clear (transparent) and draw centered scaled image
                ctx.clearRect(0, 0, targetW, targetH);
                ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

                // If we detected chroma-like background, convert that color to transparent
                if (isChroma) {
                    try {
                        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const data = imgData.data;
                        // First pass: hard remove chroma within tolerance
                        for (let i = 0; i < data.length; i += 4) {
                            const r = data[i], g = data[i + 1], b = data[i + 2];
                            const dist = colorDistance({ r, g, b }, pick);
                            if (dist <= tolerance) {
                                data[i + 3] = 0;
                            }
                        }

                        // Second pass: soft-edge feather for pixels near the threshold
                        const softRange = 30; // px color-distance range for feathering
                        const width = canvas.width;
                        const height = canvas.height;
                        for (let y = 0; y < height; y++) {
                            for (let x = 0; x < width; x++) {
                                const idx = (y * width + x) * 4;
                                const a = data[idx + 3];
                                if (a === 0) continue; // already transparent
                                const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                                const dist = colorDistance({ r, g, b }, pick);
                                if (dist <= tolerance + softRange && dist > tolerance) {
                                    // fade alpha proportionally (closer to tolerance -> more transparent)
                                    const factor = (dist - tolerance) / softRange; // 0..1
                                    const newA = Math.round(a * factor);
                                    data[idx + 3] = newA;
                                }
                            }
                        }

                        ctx.putImageData(imgData, 0, 0);
                    } catch (ex) {
                        // getImageData can fail for cross-origin images despite crossOrigin; ignore if it fails
                        console.warn('Could not perform chroma-key cleanup (cross-origin?):', ex);
                    }
                }

                resolve(canvas.toDataURL('image/png'));
            } catch (err) {
                reject(err);
            }
        };
        img.onerror = (err) => {
            reject(err);
        };
        img.src = imageUrl;
    });
};

// Helper: Upscale image via cloudApiService
// Model determines scale: x4plus → 4x, x2plus → 2x (matches AutoAgents-Redesign)
const upscaleImageViaCloud = async (dataUrl: string, model: string = 'realesrgan-x4plus'): Promise<string> => {
    try {
        // Convert dataUrl to File
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], 'image.png', { type: 'image/png' });

        // Determine scale from model name (match AutoAgents-Redesign behavior)
        const scale = model.includes('x4') ? 4 : model.includes('x2') ? 2 : 4;
        
        console.log(`🔍 Upscaling with model: ${model}, scale: ${scale}x`);

        // Call cloudApiService.upscale() with selected model
        const result = await cloudApiService.upscale(file, scale, model);
        
        if (!result.success || !result.data) {
            throw new Error(result.error || 'Upscale failed');
        }

        // Return as data URL
        const base64Data = typeof result.data === 'string' ? result.data : result.data.image || result.data.data;
        const finalDataUrl = base64Data.startsWith('data:') ? base64Data : `data:image/png;base64,${base64Data}`;
        
        console.log(`✅ Upscaled successfully to ${scale}x`);
        return finalDataUrl;
    } catch (error) {
        console.error('❌ Upscale via cloud failed:', error);
        throw error;
    }
};

type Step = 'upload' | 'cloning' | 'detecting' | 'upscaling' | 'resizing' | 'done';

export interface CloneModeState {
  originalImage: string | null;
  clonedImage: string | null;
  upscaledImage: string | null;
  finalImage: string | null;
  previewImage: string | null;
  step: Step;
  chromaTolerance: number;
  morphOp: 'dilate' | 'erode';
  morphIter: number;
  featherRadius: number;
  ssaaQuality: number;
  decontamination: number;
  edgeChoke: number;
  cornerSmoothing: number;
  cornerRefinement: number;
  edgeSmoothing: number;
  borderCleanup: number;
  contrastEnhancement: number;
  edgeRadius: number;
  matteEdge: number;
  chromaMode: 'green' | 'magenta';
  artifactCleanupSize: number;
  selectedUpscaleModel: string;
  rotationAngle: number;
  autoRotate: boolean;
}

interface CloneModeProps {
    initialState?: CloneModeState | null;
    onStateChange?: (state: CloneModeState) => void;
}

/**
 * CloneMode Component - Optimized Workflow
 * 
 * NEW WORKFLOW (October 2024):
 * 1. Upload → Auto-process at FULL RESOLUTION immediately (no preview mode)
 * 2. Settings Panel → Real-time client-side preview for instant feedback
 * 3. "Download High-Res" → Triggers background job for 4500x5100 TIFF/PNG export
 * 
 * QUALITY IMPROVEMENTS:
 * - Removed preview downscaling (was 900px max) - now processes full resolution always
 * - Sharp, crisp results visible immediately after upload
 * - No need to wait for "Apply Settings" to see quality
 * - Background exports as transparent or chroma-keyed for print production
 */
const CloneMode: React.FC<CloneModeProps> = ({ initialState, onStateChange }) => {
    const [step, setStep] = useState<Step>(initialState?.step || 'upload');
    const [originalImage, setOriginalImage] = useState<string | null>(initialState?.originalImage || null);
    const [clonedImage, setClonedImage] = useState<string | null>(initialState?.clonedImage || null);
    const [upscaledImage, setUpscaledImage] = useState<string | null>(initialState?.upscaledImage || null);
    const [finalImage, setFinalImage] = useState<string | null>(initialState?.finalImage || null);
    const [previewImage, setPreviewImage] = useState<string | null>(initialState?.previewImage || null);
    const [isReprocessing, setIsReprocessing] = useState(false);
    const [isProcessingPreview, setIsProcessingPreview] = useState(false);
    const [isImageReady, setIsImageReady] = useState(false);
    const [isInitialProcessing, setIsInitialProcessing] = useState(false);
    const previewAbortController = useRef<AbortController | null>(null);
    const zoomableImageRef = useRef<{ resetZoom: () => void }>(null);
    const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // Web Worker for off-thread image processing
    const workerRef = useRef<Worker | null>(null);
    const [processingProgress, setProcessingProgress] = useState<number>(0);
    const [isWorkerProcessing, setIsWorkerProcessing] = useState(false);
    const [isRenderingResult, setIsRenderingResult] = useState(false);
    // UI state for live-preview + zoom/pan
    const [tuningDirty, setTuningDirty] = useState(false);
    const [zoom, setZoom] = useState<number>(1);
    const [offset, setOffset] = useState<{x:number,y:number}>({x:0,y:0});
    const [isPanning, setIsPanning] = useState<boolean>(false);
    const panStartRef = useRef<{x:number,y:number}|null>(null);
    const viewportRef = useRef<HTMLDivElement|null>(null);
    // Mask tuning controls (defaults tuned for final output)
    const [chromaTolerance, setChromaTolerance] = useState<number>(initialState?.chromaTolerance || 50);
    const [morphOp, setMorphOp] = useState<'dilate'|'erode'>(initialState?.morphOp || 'dilate');
    const [morphIter, setMorphIter] = useState<number>(initialState?.morphIter || 0);
    const [featherRadius, setFeatherRadius] = useState<number>(initialState?.featherRadius || 0);
    const [outputFormat, setOutputFormat] = useState<'png'|'tiff-cmyk'>('png');
    const [chromaMode, setChromaMode] = useState<'auto'|'magenta'|'green'|'custom'>('auto');
    const [customChroma, setCustomChroma] = useState<{r:number,g:number,b:number}>({r:255,g:0,b:255});
    const [detectedChroma, setDetectedChroma] = useState<{r:number,g:number,b:number}|null>(null);
    
    // Advanced Edge Processing Controls
    const [edgeEnhancement, setEdgeEnhancement] = useState<boolean>(false);
    const [edgeSmoothing, setEdgeSmoothing] = useState<number>(initialState?.edgeSmoothing || 0);
    const [antiAliasing, setAntiAliasing] = useState<boolean>(true);
    const [colorBleedPrevention, setColorBleedPrevention] = useState<boolean>(true);
    const [adaptiveFeathering, setAdaptiveFeathering] = useState<boolean>(false);
    const [borderCleanup, setBorderCleanup] = useState<number>(initialState?.borderCleanup || 8);
    const [contrastEnhancement, setContrastEnhancement] = useState<number>(initialState?.contrastEnhancement || 37);
    // New edge refinement controls
    const [edgeRadius, setEdgeRadius] = useState<number>(initialState?.edgeRadius || 12.0);
    const [smartRadius, setSmartRadius] = useState<boolean>(true);
    const [matteEdge, setMatteEdge] = useState<number>(initialState?.matteEdge || 20);
    const [protectBlacks, setProtectBlacks] = useState<boolean>(true);
    // Precision edge controls
    const [edgeChoke, setEdgeChoke] = useState<number>(initialState?.edgeChoke || 2.0);
    const [cornerSmoothing, setCornerSmoothing] = useState<number>(initialState?.cornerSmoothing || 0);
    const [cornerRefinement, setCornerRefinement] = useState<number>(initialState?.cornerRefinement || 19);
    const [artifactCleanupSize, setArtifactCleanupSize] = useState<number>(initialState?.artifactCleanupSize || 2);
    // Advanced anti-aliasing & decontamination
    // DEFAULT = 0 for fast initial processing (user can enable later for quality)
    const [ssaaQuality, setSsaaQuality] = useState<number>(initialState?.ssaaQuality || 0);
    const [decontamination, setDecontamination] = useState<number>(initialState?.decontamination || 0);
    // Chroma Key Picker Tool
    const [isPickingChroma, setIsPickingChroma] = useState<boolean>(false);
    const [pickedChroma, setPickedChroma] = useState<{r:number,g:number,b:number}|null>(null);
    // UI improvements: advanced toggle and pen eraser tool state
    const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);
    
    // Rotation controls
    const [rotationAngle, setRotationAngle] = useState<number>(initialState?.rotationAngle || 0);
    const [autoRotate, setAutoRotate] = useState<boolean>(true);
    
    // Model selection modal
    const [showModelSelection, setShowModelSelection] = useState<boolean>(false);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [selectedUpscaleModel, setSelectedUpscaleModel] = useState<string>(initialState?.selectedUpscaleModel || 'realesrgan-x4plus');
    // Pattern extraction LLM model for cloning prompt
    const [selectedPatternModel, setSelectedPatternModel] = useState<'gemini' | 'openai'>('gemini');
    // Chroma background hex for generation prompt
    const [promptChromaHex, setPromptChromaHex] = useState<string>('#FF00FF');
    // Utility: convert hex to RGB
    const hexToRgb = useCallback((hex: string): { r: number; g: number; b: number } | null => {
        if (!hex) return null;
        let h = hex.trim().replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        return { r, g, b };
    }, []);
    // Sync live cutout chroma with chosen hex ONLY when mode is 'custom'
    useEffect(() => {
        if (chromaMode !== 'custom') return;
        const rgb = hexToRgb(promptChromaHex);
        if (rgb) {
            setCustomChroma(rgb);
            setPickedChroma(rgb);
        }
    }, [promptChromaHex, hexToRgb, chromaMode]);
    
    // Undo history for real-time edits
    const [undoHistory, setUndoHistory] = useState<string[]>([]);
    const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);
    const [redoHistory, setRedoHistory] = useState<string[]>([]);
    
    // CRITICAL: Block refinement when applying tools
    const [isApplyingTool, setIsApplyingTool] = useState<boolean>(false);
    
    // Cursor preview for brush/eraser
    const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);
    
    // Drawing tools state
    const [activeTool, setActiveTool] = useState<'pen' | 'brush' | 'eraser' | null>(null);
    const [brushSize, setBrushSize] = useState<number>(20);
    const [brushColor, setBrushColor] = useState<string>('#FF0000');
    const [brushOpacity, setBrushOpacity] = useState<number>(1);
    const [isDrawing, setIsDrawing] = useState<boolean>(false);
    const [brushStrokes, setBrushStrokes] = useState<Array<{
        type: 'brush' | 'eraser';
        points: Array<{x: number, y: number}>;
        size: number;
        color?: string;
        opacity?: number;
    }>>([]);
    
    // Pen tool state
    const [isPenErasing, setIsPenErasing] = useState<boolean>(false);
    const [penPoints, setPenPoints] = useState<Array<{
        x: number; 
        y: number; 
        cp1?: {x:number, y:number}; 
        cp2?: {x:number, y:number};
        type: 'smooth' | 'corner';
    }>>([]);
    const penDrawingRef = useRef<boolean>(false);
    const polygonContainerRef = useRef<HTMLDivElement | null>(null);
    const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
    const [hoveredHandleInfo, setHoveredHandleInfo] = useState<{pointIndex: number, handleType: 'cp1' | 'cp2'} | null>(null);
    const [isNearFirstPoint, setIsNearFirstPoint] = useState<boolean>(false);
    const [currentMousePos, setCurrentMousePos] = useState<{x: number, y: number} | null>(null);
    const [isDraggingHandle, setIsDraggingHandle] = useState<boolean>(false);
    const [dragStartPos, setDragStartPos] = useState<{x: number, y: number} | null>(null);
    const [isDraggingAnchor, setIsDraggingAnchor] = useState<{pointIndex: number} | null>(null);
    const [isDrawingHandle, setIsDrawingHandle] = useState<boolean>(false);
    const [isAltPressed, setIsAltPressed] = useState<boolean>(false);
    const [isCtrlPressed, setIsCtrlPressed] = useState<boolean>(false);
    const [isShiftPressed, setIsShiftPressed] = useState<boolean>(false);
    const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
    const [tempRepositionAnchor, setTempRepositionAnchor] = useState<{x: number, y: number} | null>(null);
    // Preview background options (checkerboard / chroma green / custom)
    const [previewBgMode, setPreviewBgMode] = useState<'checker'|'green'|'custom'>('checker');
    const [previewBgColor, setPreviewBgColor] = useState<string>('#ffffff');
    const [previewBgOpacity, setPreviewBgOpacity] = useState<number>(0.9);

    const panelBgStyle = useMemo(() => {
        if (previewBgMode === 'checker') {
            return {
                backgroundImage: 'linear-gradient(45deg,#6b6b6b 25%,transparent 25%),linear-gradient(-45deg,#6b6b6b 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#6b6b6b 75%),linear-gradient(-45deg,transparent 75%,#6b6b6b 75%)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0,0 10px,10px -10px,-10px 0',
                backgroundColor: `rgba(107, 107, 107, ${previewBgOpacity})`
            } as React.CSSProperties;
        }
        if (previewBgMode === 'green') {
            return { backgroundColor: `rgba(0, 255, 0, ${previewBgOpacity})` } as React.CSSProperties;
        }
        // compute rgba from hex for custom mode
        const hex = previewBgColor.replace('#','');
        const r = parseInt(hex.substring(0,2),16)||255;
        const g = parseInt(hex.substring(2,4),16)||255;
        const b = parseInt(hex.substring(4,6),16)||255;
        return { backgroundColor: `rgba(${r},${g},${b},${previewBgOpacity})` } as React.CSSProperties;
    }, [previewBgMode, previewBgColor, previewBgOpacity]);

    const detectChromaFromImage = async (url: string) => {
        return new Promise<{r:number,g:number,b:number}>((resolve)=>{
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const w = img.naturalWidth, h = img.naturalHeight;
                const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); if (!ctx) return resolve({r:255,g:0,b:255});
                ctx.drawImage(img,0,0);
                const sample = (x:number,y:number)=>{
                    const d = ctx.getImageData(Math.max(0,x),Math.max(0,y),3,3).data; let r=0,g=0,b=0,cnt=0; for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];cnt++;} return {r:Math.round(r/cnt),g:Math.round(g/cnt),b:Math.round(b/cnt)};
                };
                
                // PRIMARY: Sample from top center (main detection point)
                const topCenter = sample(Math.floor(w/2), 1);
                
                // FALLBACK: If top center is black/white, try other positions
                const brightness = topCenter.r + topCenter.g + topCenter.b;
                const isValid = brightness > 50 && brightness < 700;
                
                if (isValid) {
                    // Top center is good, use it
                    resolve(topCenter);
                } else {
                    // Top center is black/white, try other edges
                    // Keep priority: top-center first (already attempted). Fallback sampling order remains deterministic
                    const fallbackSamples = [
                        sample(Math.floor(w/2), h-4),         // bottom center
                        sample(1, Math.floor(h/2)),           // left center
                        sample(w-4, Math.floor(h/2)),         // right center
                        sample(1, 1),                         // top-left corner
                        sample(w-4, 1),                       // top-right corner
                    ];
                    
                    const validSamples = fallbackSamples.filter(c => {
                        const b = c.r + c.g + c.b;
                        return b > 50 && b < 700;
                    });
                    
                    if (validSamples.length > 0) {
                        // Pick the brightest valid sample (likely chroma)
                        const pick = validSamples.reduce((a,b)=>((b.r+b.g+b.b) > (a.r+a.g+a.b) ? b : a), validSamples[0]);
                        resolve(pick);
                    } else {
                        // All samples are black/white, default to magenta
                        resolve({r:255,g:0,b:255});
                    }
                }
            };
            img.onerror = ()=>resolve({r:255,g:0,b:255});
            img.src = url;
        });
    };

    const runProcessCutout = useCallback(async (imageUrl: string, isFullResExport: boolean = false) => {
    let chromaToUse = { r: 255, g: 0, b: 255 };
    if (chromaMode === 'custom') {
        chromaToUse = pickedChroma || customChroma;
    } else if (chromaMode === 'auto' || chromaMode === 'magenta' || chromaMode === 'green') {
        try {
            const detected = await detectChromaFromImage(imageUrl);
            setDetectedChroma(detected);
            chromaToUse = detected;
        } catch (e) {
            console.warn('Auto chroma detection failed', e);
            if (chromaMode === 'green') chromaToUse = { r: 0, g: 255, b: 0 };
            else chromaToUse = { r: 255, g: 0, b: 255 };
        }
    }

    const params: any = {
        chroma: chromaToUse,
        tolerance: chromaTolerance,
        morph: { op: morphOp, iter: morphIter },
        feather: featherRadius,
        output: outputFormat,
        // NO preview flag - always process full resolution for sharp quality
        preview: false,
        // Advanced anti-aliasing & decontamination (now user-controllable)
        ssaaQuality: ssaaQuality,
        decontamination: decontamination / 10, // Convert 0-20 slider to 0-2 range
        useGuidedFilter: true,
        // Advanced edge processing
        edgeEnhancement,
        edgeSmoothing,
        antiAliasing,
        colorBleedPrevention,
        adaptiveFeathering,
        borderCleanup,
        contrastEnhancement,
        edgeRadius,
        smartRadius,
        matteEdge,
        protectBlacks,
        edgeChoke,
        cornerSmoothing,
        cornerRefinement,
        artifactCleanupSize,
        pickedChroma,
    // model selection handled at generation stage
    };

    return await processCutout(imageUrl, params);
}, [
    chromaMode, customChroma, chromaTolerance, morphOp, morphIter, featherRadius, outputFormat,
    edgeEnhancement, edgeSmoothing, antiAliasing, colorBleedPrevention,
    adaptiveFeathering, borderCleanup, contrastEnhancement, edgeRadius, smartRadius, matteEdge, protectBlacks,
    edgeChoke, cornerSmoothing, cornerRefinement, artifactCleanupSize, pickedChroma,
    ssaaQuality, decontamination
]);

    // OPTIMIZED: Mark tuning as dirty when sliders change, but DON'T call server
    // Server processing only happens when user clicks "Save Final" button
    // This fixes: "Bảng điều khiển không hoạt động" và "Chroma key chạy quá lâu (5-6 phút)"
    useEffect(() => {
        if (step !== 'done') return;
        // Just mark as dirty so user knows changes are pending
        setTuningDirty(true);
    }, [
        chromaTolerance, morphOp, morphIter, featherRadius, chromaMode, customChroma,
        edgeEnhancement, edgeSmoothing, antiAliasing, colorBleedPrevention,
        adaptiveFeathering, borderCleanup, contrastEnhancement, edgeRadius, smartRadius, 
        matteEdge, protectBlacks, edgeChoke, cornerSmoothing, cornerRefinement, 
        artifactCleanupSize, ssaaQuality, decontamination, step
    ]);

    // PHOTOSHOP-STYLE REAL-TIME PREVIEW: Client-side instant feedback with caching
    // Generate lightweight preview when sliders change (NO server calls)
    const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const cachedMaskDataRef = useRef<ImageData | null>(null);
    const lastPreviewParamsRef = useRef<string>('');
    const refinementTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // OPTIMIZED REAL-TIME PREVIEW: Smart caching to reduce latency
    // Strategy:
    // - "Heavy" params (tolerance, morph, SSAA) → Server re-process (2-5s)
    // - "Light" params (feather, choke, corner) → Client-side refinement (<100ms)
    const [cachedBaseMask, setCachedBaseMask] = useState<string | null>(null);
    const [heavyParams, setHeavyParams] = useState<string>('');
    
    // Categorize parameters by processing weight
    // HEAVY (server-only): NO HEAVY PARAMS - All processing moved to client-side
    const currentHeavyParams = useMemo(() => 
        '',
        []
    );
    
    // LIGHT (client-side real-time): All params process instantly including rotation
    const currentLightParams = useMemo(() =>
        `${chromaTolerance}-${morphOp}-${morphIter}-${featherRadius}-${edgeChoke}-${cornerSmoothing}-${cornerRefinement}-${edgeSmoothing}-${borderCleanup}-${contrastEnhancement}-${edgeRadius}-${matteEdge}-${chromaMode}-${ssaaQuality}-${decontamination}-${rotationAngle}`,
        [chromaTolerance, morphOp, morphIter, featherRadius, edgeChoke, cornerSmoothing, cornerRefinement, edgeSmoothing, borderCleanup, contrastEnhancement, edgeRadius, matteEdge, chromaMode, ssaaQuality, decontamination, rotationAngle]
    );
    
    // SMART PREVIEW: Only re-process server if heavy params change
    useEffect(() => {
        if (step !== 'done' || !upscaledImage || isReprocessing || isInitialProcessing) return;
        
        // CRITICAL: Block ALL refinement when applying tools
        if (isApplyingTool) {
            console.log('🚫 Refinement BLOCKED - Tool apply in progress');
            return;
        }
        
        // CRITICAL: Skip auto-refinement when user is actively using drawing tools
        // This prevents refinement from overwriting pen/brush edits
        if (activeTool !== null) {
            console.log('⏸️  Skipping auto-refinement (tool active:', activeTool, ')');
            return;
        }
        
        if (penPoints.length > 0) {
            console.log('⏸️  Skipping auto-refinement (pen points present)');
            return;
        }
        
        if (brushStrokes.length > 0) {
            console.log('⏸️  Skipping auto-refinement (brush strokes present)');
            return;
        }
        
        const needsServerReprocess = currentHeavyParams !== heavyParams;
        
        if (needsServerReprocess) {
            // Heavy params changed → Full server re-process
            // Abort any pending request
            if (previewAbortController.current) {
                previewAbortController.current.abort();
            }
            
            const timeoutId = setTimeout(() => {
                console.log('🔄 Heavy params changed → Server re-process');
                reprocessPreview();
                setHeavyParams(currentHeavyParams);
            }, 800); // Shorter debounce for heavy params
            
            return () => {
                clearTimeout(timeoutId);
                if (previewAbortController.current) {
                    previewAbortController.current.abort();
                }
            };
        } else {
            // Only light params changed → Fast client-side refinement
            // PERFORMANCE: Increased debounce to reduce CPU usage
            const timeoutId = setTimeout(() => {
                console.log('⚡ Light params changed → Client-side refinement');
                applyClientSideRefinement();
            }, 400); // Increased from 150ms to 400ms for better performance
            
            refinementTimeoutRef.current = timeoutId; // Store for cancellation
            
            return () => {
                clearTimeout(timeoutId);
                refinementTimeoutRef.current = null;
            };
        }
    }, [
        currentHeavyParams,
        currentLightParams,
        step, 
        upscaledImage, 
        isReprocessing,
        isInitialProcessing,
        heavyParams
        // NOTE: activeTool, penPoints, brushStrokes NOT in deps
        // They are checked inside but don't trigger the effect
    ]);
    
    // AUTOSAVE: Sync state to parent with debouncing to prevent excessive re-renders
    const stateSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    useEffect(() => {
        if (!onStateChange) return;
        
        // Clear previous timeout
        if (stateSyncTimeoutRef.current) {
            clearTimeout(stateSyncTimeoutRef.current);
        }
        
        // Debounce state sync (only sync after 500ms of no changes)
        stateSyncTimeoutRef.current = setTimeout(() => {
            const currentState: CloneModeState = {
                originalImage,
                clonedImage,
                upscaledImage,
                finalImage,
                previewImage,
                step,
                chromaTolerance,
                morphOp,
                morphIter,
                featherRadius,
                ssaaQuality,
                decontamination,
                edgeChoke,
                cornerSmoothing,
                cornerRefinement,
                edgeSmoothing,
                borderCleanup,
                contrastEnhancement,
                edgeRadius,
                matteEdge,
                chromaMode: chromaMode === 'green' ? 'green' : 'magenta',
                artifactCleanupSize,
                selectedUpscaleModel,
                rotationAngle,
                autoRotate,
            };
            onStateChange(currentState);
        }, 500); // 500ms debounce
        
        return () => {
            if (stateSyncTimeoutRef.current) {
                clearTimeout(stateSyncTimeoutRef.current);
            }
        };
    }, [
        originalImage, clonedImage, upscaledImage, finalImage, previewImage, step,
        chromaTolerance, morphOp, morphIter, featherRadius, ssaaQuality, decontamination,
        edgeChoke, cornerSmoothing, cornerRefinement, edgeSmoothing, borderCleanup,
        contrastEnhancement, edgeRadius, matteEdge, chromaMode, artifactCleanupSize,
        selectedUpscaleModel, onStateChange
    ]);
    
    // REALTIME BRUSH/ERASER PREVIEW: Optimized with RAF throttling
    const brushRenderRAF = useRef<number | null>(null);
    const lastRenderedStrokeCount = useRef(0);
    
    useEffect(() => {
        if (!polygonContainerRef.current || brushStrokes.length === 0) {
            // Clean up overlay canvas when no strokes
            const existingOverlay = polygonContainerRef.current?.querySelector('canvas.brush-overlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }
            lastRenderedStrokeCount.current = 0;
            return;
        }
        
        // Cancel pending RAF if exists
        if (brushRenderRAF.current !== null) {
            cancelAnimationFrame(brushRenderRAF.current);
        }
        
        // Use RAF to throttle rendering (60fps max)
        brushRenderRAF.current = requestAnimationFrame(() => {
            if (!polygonContainerRef.current) return;
            
            const imgElement = polygonContainerRef.current.querySelector('img');
            if (!imgElement) return;
            
            // Create or get overlay canvas
            let overlayCanvas = polygonContainerRef.current.querySelector('canvas.brush-overlay') as HTMLCanvasElement;
            if (!overlayCanvas) {
                overlayCanvas = document.createElement('canvas');
                overlayCanvas.className = 'brush-overlay absolute pointer-events-none';
                overlayCanvas.style.zIndex = '34';
                polygonContainerRef.current.appendChild(overlayCanvas);
            }
            
            const imgRect = imgElement.getBoundingClientRect();
            const parentRect = polygonContainerRef.current.getBoundingClientRect();
            
            // Only resize if dimensions changed
            const needsResize = overlayCanvas.width !== imgRect.width || overlayCanvas.height !== imgRect.height;
            if (needsResize) {
                overlayCanvas.width = imgRect.width;
                overlayCanvas.height = imgRect.height;
                overlayCanvas.style.width = `${imgRect.width}px`;
                overlayCanvas.style.height = `${imgRect.height}px`;
                overlayCanvas.style.left = `${imgRect.left - parentRect.left}px`;
                overlayCanvas.style.top = `${imgRect.top - parentRect.top}px`;
            }
            
            const ctx = overlayCanvas.getContext('2d', { alpha: true, desynchronized: true });
            if (!ctx) return;
            
            // OPTIMIZATION: Only redraw new strokes if count increased by 1
            const strokeCountChanged = brushStrokes.length !== lastRenderedStrokeCount.current;
            const isIncremental = brushStrokes.length === lastRenderedStrokeCount.current + 1;
            
            if (!isIncremental || needsResize) {
                // Full redraw needed
                ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
                lastRenderedStrokeCount.current = 0;
            }
            
            // Draw only new strokes (incremental rendering)
            const startIdx = lastRenderedStrokeCount.current;
            for (let i = startIdx; i < brushStrokes.length; i++) {
                const stroke = brushStrokes[i];
                
                if (stroke.type === 'eraser') {
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
                    ctx.globalAlpha = 0.5;
                } else {
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.strokeStyle = stroke.color || '#FF0000';
                    ctx.globalAlpha = stroke.opacity || 1;
                }
                
                ctx.lineWidth = stroke.size;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                ctx.beginPath();
                stroke.points.forEach((p, j) => {
                    const px = p.x * overlayCanvas.width;
                    const py = p.y * overlayCanvas.height;
                    if (j === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                });
                ctx.stroke();
            }
            
            ctx.globalAlpha = 1;
            lastRenderedStrokeCount.current = brushStrokes.length;
        });
        
        return () => {
            if (brushRenderRAF.current !== null) {
                cancelAnimationFrame(brushRenderRAF.current);
            }
        };
    }, [brushStrokes]);
    
    // Initialize Web Worker for off-thread processing
    useEffect(() => {
        // Create worker on mount
        workerRef.current = new Worker('/workers/imageProcessor.worker.js');
        
        // Setup message handler
        workerRef.current.onmessage = (e) => {
            const { type, imageData, progress, error } = e.data;
            
            if (type === 'progress') {
                setProcessingProgress(progress);
            } else if (type === 'complete') {
                // Worker done, now render to canvas (async to avoid blocking)
                setIsRenderingResult(true);
                
                // Use RAF to ensure smooth transition
                requestAnimationFrame(() => {
                    const canvas = document.createElement('canvas');
                    canvas.width = imageData.width;
                    canvas.height = imageData.height;
                    const ctx = canvas.getContext('2d');
                    
                    if (ctx) {
                        ctx.putImageData(imageData, 0, 0);
                        
                        // Apply SSAA downsampling if needed (on main thread, but fast)
                        if (ssaaQuality > 1.0) {
                            const targetWidth = Math.round(canvas.width / ssaaQuality);
                            const targetHeight = Math.round(canvas.height / ssaaQuality);
                            const downCanvas = document.createElement('canvas');
                            downCanvas.width = targetWidth;
                            downCanvas.height = targetHeight;
                            const downCtx = downCanvas.getContext('2d', { alpha: true });
                            if (downCtx) {
                                downCtx.imageSmoothingEnabled = true;
                                downCtx.imageSmoothingQuality = 'high';
                                downCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
                                
                                // Convert to DataURL async
                                downCanvas.toBlob((blob) => {
                                    if (blob) {
                                        const url = URL.createObjectURL(blob);
                                        setPreviewImage(url);
                                    } else {
                                        // Fallback to dataURL if blob fails
                                        setPreviewImage(downCanvas.toDataURL('image/png'));
                                    }
                                    
                                    // Clear all processing states AFTER image is set
                                    setIsRenderingResult(false);
                                    setIsWorkerProcessing(false);
                                    setIsProcessingPreview(false);
                                    setProcessingProgress(0);
                                }, 'image/png');
                            }
                        } else {
                            // No SSAA, use blob for better performance
                            canvas.toBlob((blob) => {
                                if (blob) {
                                    const url = URL.createObjectURL(blob);
                                    setPreviewImage(url);
                                } else {
                                    // Fallback to dataURL if blob fails
                                    setPreviewImage(canvas.toDataURL('image/png'));
                                }
                                
                                // Clear all processing states AFTER image is set
                                setIsRenderingResult(false);
                                setIsWorkerProcessing(false);
                                setIsProcessingPreview(false);
                                setProcessingProgress(0);
                            }, 'image/png');
                        }
                    } else {
                        // Failed to get context
                        setIsRenderingResult(false);
                        setIsWorkerProcessing(false);
                        setIsProcessingPreview(false);
                        setProcessingProgress(0);
                    }
                });
            } else if (type === 'error') {
                console.error('❌ Worker error:', error);
                setIsRenderingResult(false);
                setIsWorkerProcessing(false);
                setIsProcessingPreview(false);
                setProcessingProgress(0);
            }
        };
        
        // Cleanup on unmount
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, []); // Only run once on mount
    
    // FAST CLIENT-SIDE REFINEMENT WITH WEB WORKER: Non-blocking full resolution processing
    // Works on cached base result from server for instant feedback
    // OPTIMIZED: Uses Web Worker to process off main thread - UI stays responsive
    const applyClientSideRefinement = useCallback(async () => {
        // CRITICAL: Use finalImage if available (includes tool edits)
        // Fall back to upscaledImage only if no edits have been made
        const baseImage = finalImage || upscaledImage;
        if (!baseImage || isWorkerProcessing) return;
        
        setIsProcessingPreview(true);
        setIsWorkerProcessing(true);
        setProcessingProgress(0);
        
        try {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = baseImage;
            });
            
            // FULL RESOLUTION PROCESSING: Process at original size for WYSIWYG
            // Preview = Download (no server reprocess needed)
            const canvas = document.createElement('canvas');
            
            // Apply SSAA upscaling if needed BEFORE processing
            if (ssaaQuality > 1.0) {
                canvas.width = Math.round(img.naturalWidth * ssaaQuality);
                canvas.height = Math.round(img.naturalHeight * ssaaQuality);
            } else {
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
            }
            
            console.log(`🎨 Client-side processing at FULL RES (Worker): ${canvas.width}x${canvas.height} (SSAA: ${ssaaQuality}x)`);
            
            const ctx = canvas.getContext('2d', { 
                willReadFrequently: true,
                alpha: true
            });
            if (!ctx) {
                setIsWorkerProcessing(false);
                setIsProcessingPreview(false);
                return;
            }
            
            // Apply rotation if angle is set
            if (rotationAngle !== 0) {
                const angleRad = (rotationAngle * Math.PI) / 180;
                const cos = Math.abs(Math.cos(angleRad));
                const sin = Math.abs(Math.sin(angleRad));
                
                // Recalculate canvas size for rotated image
                const rotatedWidth = Math.ceil(img.naturalWidth * cos + img.naturalHeight * sin);
                const rotatedHeight = Math.ceil(img.naturalWidth * sin + img.naturalHeight * cos);
                
                // Apply SSAA to rotated dimensions
                if (ssaaQuality > 1.0) {
                    canvas.width = Math.round(rotatedWidth * ssaaQuality);
                    canvas.height = Math.round(rotatedHeight * ssaaQuality);
                } else {
                    canvas.width = rotatedWidth;
                    canvas.height = rotatedHeight;
                }
                
                // Apply rotation transform
                ctx.save();
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(angleRad);
                
                // Draw with high quality scaling
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                const drawWidth = ssaaQuality > 1.0 ? img.naturalWidth * ssaaQuality : img.naturalWidth;
                const drawHeight = ssaaQuality > 1.0 ? img.naturalHeight * ssaaQuality : img.naturalHeight;
                ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
                ctx.restore();
                
                console.log(`🔄 Applied rotation: ${rotationAngle.toFixed(2)}° (${canvas.width}x${canvas.height})`);
            } else {
                // No rotation - standard draw
                // Draw with high quality scaling if SSAA
                if (ssaaQuality > 1.0) {
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Determine target chroma color
            let targetChroma = { r: 255, g: 0, b: 255 }; // Default magenta
            if (chromaMode === 'custom' && (pickedChroma || customChroma)) {
                targetChroma = pickedChroma || customChroma;
            } else if (chromaMode === 'green') {
                targetChroma = { r: 0, g: 255, b: 0 };
            } else if (detectedChroma) {
                targetChroma = detectedChroma;
            }
            
            // Send to Worker for processing (non-blocking)
            if (workerRef.current) {
                workerRef.current.postMessage({
                    type: 'process',
                    imageData: imageData,
                    width: canvas.width,
                    height: canvas.height,
                    params: {
                        chromaTolerance,
                        targetChroma,
                        edgeChoke,
                        featherRadius,
                        morphIter,
                        morphOp,
                        decontaminationStrength: decontamination
                    }
                }, [imageData.data.buffer]); // Transfer ownership for zero-copy
            }
            
        } catch (error) {
            console.error('❌ Error in client-side refinement:', error);
            setIsWorkerProcessing(false);
            setIsProcessingPreview(false);
        }
    }, [
        finalImage, upscaledImage, chromaTolerance, morphOp, morphIter, featherRadius, 
        edgeChoke, chromaMode, pickedChroma, customChroma, detectedChroma, ssaaQuality, 
        decontamination, isWorkerProcessing
    ]);
    
    // LEGACY: Old synchronous processing (kept as fallback)
    const applyClientSideRefinementLegacy = useCallback(async () => {
        // CRITICAL: Use finalImage if available (includes tool edits)
        // Fall back to upscaledImage only if no edits have been made
        const baseImage = finalImage || upscaledImage;
        if (!baseImage) return;
        
        setIsProcessingPreview(true);
        
        try {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = baseImage;
            });
            
            // FULL RESOLUTION PROCESSING: Process at original size for WYSIWYG
            // Preview = Download (no server reprocess needed)
            const canvas = document.createElement('canvas');
            
            // Apply rotation if angle is set
            if (rotationAngle !== 0) {
                const angleRad = (rotationAngle * Math.PI) / 180;
                const cos = Math.abs(Math.cos(angleRad));
                const sin = Math.abs(Math.sin(angleRad));
                
                // Calculate rotated dimensions
                canvas.width = Math.ceil(img.naturalWidth * cos + img.naturalHeight * sin);
                canvas.height = Math.ceil(img.naturalWidth * sin + img.naturalHeight * cos);
            } else {
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
            }
            
            console.log(`🎨 Client-side processing at FULL RES: ${canvas.width}x${canvas.height}${rotationAngle !== 0 ? ` (rotated ${rotationAngle.toFixed(2)}°)` : ''}`);
            
            const ctx = canvas.getContext('2d', { 
                willReadFrequently: true,
                alpha: true,
                desynchronized: true // Allow async rendering for better performance
            });
            if (!ctx) return;
            
            // Apply rotation transform if needed
            if (rotationAngle !== 0) {
                const angleRad = (rotationAngle * Math.PI) / 180;
                ctx.save();
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(angleRad);
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
                ctx.restore();
            } else {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // OPTIMIZATION: Process in chunks to avoid blocking main thread
            const processChunk = async (processor: () => void) => {
                return new Promise<void>(resolve => {
                    if ('requestIdleCallback' in window) {
                        requestIdleCallback(() => {
                            processor();
                            resolve();
                        }, { timeout: 50 });
                    } else {
                        setTimeout(() => {
                            processor();
                            resolve();
                        }, 0);
                    }
                });
            };
            
            // REAL-TIME CHROMA KEYING: Apply tolerance changes instantly
            await processChunk(() => {
                // Determine target chroma color
                let targetChroma = { r: 255, g: 0, b: 255 }; // Default magenta
                if (chromaMode === 'custom' && (pickedChroma || customChroma)) {
                    targetChroma = pickedChroma || customChroma;
                } else if (chromaMode === 'green') {
                    targetChroma = { r: 0, g: 255, b: 0 };
                } else if (detectedChroma) {
                    targetChroma = detectedChroma;
                }
                
                // Fast chroma key removal
                const colorDistance = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) => {
                    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
                };
                
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    const dist = colorDistance(r, g, b, targetChroma.r, targetChroma.g, targetChroma.b);
                    
                    if (dist <= chromaTolerance) {
                        // Hard remove chroma
                        data[i + 3] = 0;
                    } else if (dist <= chromaTolerance + 30) {
                        // Soft edge feathering for smooth transitions
                        const alpha = ((dist - chromaTolerance) / 30) * 255;
                        data[i + 3] = Math.min(data[i + 3], Math.round(alpha));
                    }
                }
            });
            
            // Apply client-side refinements to alpha channel
            const width = canvas.width;
            const height = canvas.height;
            
            // 1. Edge Choke: Contract/expand edges (OPTIMIZED with clamping)
            if (edgeChoke !== 0) {
                await processChunk(() => {
                    const chokeAmount = Math.min(Math.round(Math.abs(edgeChoke)), 5); // Clamp to max 5 iterations
                    const isExpand = edgeChoke > 0;
                    
                    // Simple morphological operation on alpha
                    for (let iter = 0; iter < chokeAmount; iter++) {
                        const tempData = new Uint8ClampedArray(data.length);
                        tempData.set(data);
                        
                        // Process all pixels for full quality
                        for (let y = 1; y < height - 1; y++) {
                            for (let x = 1; x < width - 1; x++) {
                                const idx = (y * width + x) * 4;
                                const alpha = data[idx + 3];
                                
                                // Skip fully transparent/opaque pixels
                                if (alpha === 0 || alpha === 255) continue;
                                
                                const neighbors = [
                                    data[((y-1) * width + x) * 4 + 3],
                                    data[((y+1) * width + x) * 4 + 3],
                                    data[(y * width + (x-1)) * 4 + 3],
                                    data[(y * width + (x+1)) * 4 + 3]
                                ];
                                
                                if (isExpand) {
                                    // Dilate: max of neighbors
                                    const maxNeighbor = Math.max(...neighbors);
                                    tempData[idx + 3] = Math.max(alpha, maxNeighbor);
                                } else {
                                    // Erode: min of neighbors
                                    const minNeighbor = Math.min(...neighbors);
                                    tempData[idx + 3] = Math.min(alpha, minNeighbor);
                                }
                            }
                        }
                        data.set(tempData);
                    }
                });
            }
            
            // 2. Feather: Gaussian blur on alpha channel (OPTIMIZED)
            if (featherRadius > 0) {
                await processChunk(() => {
                    const radius = Math.min(Math.round(featherRadius), 30); // Clamp to 30 for performance
                    const kernel = createGaussianKernel(radius);
                    const tempAlpha = new Float32Array(width * height);
                    
                    // Extract alpha channel
                    for (let i = 0; i < width * height; i++) {
                        tempAlpha[i] = data[i * 4 + 3];
                    }
                    
                    // OPTIMIZATION: Use box blur approximation for large radius (3x faster)
                    if (radius > 15) {
                        // Box blur (approximate Gaussian)
                        boxBlurAlpha(tempAlpha, width, height, radius, data);
                    } else {
                        // Accurate Gaussian blur (separable)
                        // Horizontal pass
                        const temp1 = new Float32Array(width * height);
                        for (let y = 0; y < height; y++) {
                            for (let x = 0; x < width; x++) {
                                let sum = 0, weightSum = 0;
                                for (let k = -radius; k <= radius; k++) {
                                    const nx = x + k;
                                    if (nx >= 0 && nx < width) {
                                        sum += tempAlpha[y * width + nx] * kernel[k + radius];
                                        weightSum += kernel[k + radius];
                                    }
                                }
                                temp1[y * width + x] = sum / weightSum;
                            }
                        }
                        
                        // Vertical pass
                        for (let y = 0; y < height; y++) {
                            for (let x = 0; x < width; x++) {
                                let sum = 0, weightSum = 0;
                                for (let k = -radius; k <= radius; k++) {
                                    const ny = y + k;
                                    if (ny >= 0 && ny < height) {
                                        sum += temp1[ny * width + x] * kernel[k + radius];
                                        weightSum += kernel[k + radius];
                                    }
                                }
                                data[(y * width + x) * 4 + 3] = Math.round(sum / weightSum);
                            }
                        }
                    }
                });
            }
            
            // 2.5. Morphology (Dilate/Erode): Apply morphological operations
            if (morphIter > 0) {
                await processChunk(() => {
                    const iterations = Math.min(morphIter, 10); // Clamp for performance
                    
                    for (let iter = 0; iter < iterations; iter++) {
                        const tempData = new Uint8ClampedArray(data.length);
                        tempData.set(data);
                        
                        for (let y = 1; y < height - 1; y++) {
                            for (let x = 1; x < width - 1; x++) {
                                const idx = (y * width + x) * 4;
                                const alpha = data[idx + 3];
                                
                                // 3x3 kernel neighbors
                                const neighbors = [
                                    data[((y-1) * width + (x-1)) * 4 + 3],
                                    data[((y-1) * width + x) * 4 + 3],
                                    data[((y-1) * width + (x+1)) * 4 + 3],
                                    data[(y * width + (x-1)) * 4 + 3],
                                    data[(y * width + (x+1)) * 4 + 3],
                                    data[((y+1) * width + (x-1)) * 4 + 3],
                                    data[((y+1) * width + x) * 4 + 3],
                                    data[((y+1) * width + (x+1)) * 4 + 3]
                                ];
                                
                                if (morphOp === 'dilate') {
                                    // Expand alpha (grow mask)
                                    tempData[idx + 3] = Math.max(alpha, ...neighbors);
                                } else {
                                    // Contract alpha (shrink mask)
                                    tempData[idx + 3] = Math.min(alpha, ...neighbors);
                                }
                            }
                        }
                        data.set(tempData);
                    }
                });
            }
            
            // 3. Edge Smoothing: Median filter on edges
            if (edgeSmoothing > 0) {
                await processChunk(() => {
                    const smoothRadius = Math.min(Math.round(edgeSmoothing / 5), 5); // More aggressive (was /10)
                    const tempData = new Uint8ClampedArray(data.length);
                    tempData.set(data);
                    
                    console.log(`🔄 Edge Smoothing: radius=${smoothRadius}`);
                    let smoothedCount = 0;
                    
                    for (let y = smoothRadius; y < height - smoothRadius; y++) {
                        for (let x = smoothRadius; x < width - smoothRadius; x++) {
                            const idx = (y * width + x) * 4;
                            const alpha = data[idx + 3];
                            
                            // Only smooth edges (not fully opaque/transparent)
                            if (alpha > 10 && alpha < 245) {
                                const neighbors: number[] = [];
                                for (let dy = -smoothRadius; dy <= smoothRadius; dy++) {
                                    for (let dx = -smoothRadius; dx <= smoothRadius; dx++) {
                                        neighbors.push(data[((y + dy) * width + (x + dx)) * 4 + 3]);
                                    }
                                }
                                neighbors.sort((a, b) => a - b);
                                tempData[idx + 3] = neighbors[Math.floor(neighbors.length / 2)];
                                smoothedCount++;
                            }
                        }
                    }
                    data.set(tempData);
                    console.log(`✅ Smoothed ${smoothedCount} edge pixels`);
                });
            }
            
            // 4. Border Cleanup & Artifact Cleanup: Optimized for performance
            if (borderCleanup > 0 || artifactCleanupSize > 0) {
                await processChunk(() => {
                    console.log(`🧹 Artifact Cleanup (border: ${borderCleanup}, size: ${artifactCleanupSize}px²)`);
                    
                    // PERFORMANCE: Skip if values are too small to matter
                    if (borderCleanup < 1 && artifactCleanupSize < 1) {
                        console.log('⏭️ Skipping artifact cleanup (values too small)');
                        return;
                    }
                    
                    // ENHANCED: Use artifactCleanupSize as primary control
                    const minClusterSize = Math.max(borderCleanup, artifactCleanupSize * 4);
                    
                    // OPTIMIZATION: Use simpler 4-connected instead of 8-connected for better performance
                    const visited = new Uint8Array(data.length / 4);
                    const tempData = new Uint8ClampedArray(data.length);
                    tempData.set(data);
                    
                    // Optimized flood fill with max iteration limit
                    const floodFill = (startIdx: number): number => {
                        const queue = [startIdx];
                        let size = 0;
                        const maxIterations = 10000; // Prevent infinite loops on large clusters
                        let iterations = 0;
                        
                        while (queue.length > 0 && iterations < maxIterations) {
                            iterations++;
                            const idx = queue.shift()!;
                            if (visited[idx] || data[idx * 4 + 3] === 0) continue;
                            
                            visited[idx] = 1;
                            size++;
                            
                            const x = idx % width;
                            const y = Math.floor(idx / width);
                            
                            // OPTIMIZATION: Use 4-connected (not 8) for faster processing
                            const neighbors = [
                                { dx: 0, dy: -1 }, // top
                                { dx: 1, dy: 0 },  // right
                                { dx: 0, dy: 1 },  // bottom
                                { dx: -1, dy: 0 }  // left
                            ];
                            
                            for (const { dx, dy } of neighbors) {
                                const nx = x + dx;
                                const ny = y + dy;
                                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                    const nidx = ny * width + nx;
                                    if (!visited[nidx] && data[nidx * 4 + 3] > 0) {
                                        queue.push(nidx);
                                    }
                                }
                            }
                        }
                        return size;
                    };
                    
                    // Find and remove small clusters
                    let removedClusters = 0;
                    let totalRemovedPixels = 0;
                    let processedPixels = 0;
                    
                    // OPTIMIZATION: Sample every 2nd pixel for large images
                    const step = width * height > 1000000 ? 2 : 1;
                    
                    for (let i = 0; i < visited.length; i += step) {
                        if (!visited[i] && data[i * 4 + 3] > 0) {
                            processedPixels++;
                            const clusterSize = floodFill(i);
                            
                            if (clusterSize < minClusterSize) {
                                // Remove this small cluster
                                for (let j = 0; j < visited.length; j++) {
                                    if (visited[j] === 1) {
                                        tempData[j * 4 + 3] = 0; // Make transparent
                                        totalRemovedPixels++;
                                    }
                                }
                                removedClusters++;
                            }
                            // Reset visited for next cluster
                            visited.fill(0);
                        }
                    }
                    
                    data.set(tempData);
                    console.log(`✅ Removed ${removedClusters} clusters (${totalRemovedPixels}px total) - Processed ${processedPixels} regions with threshold: ${minClusterSize}px²`);
                });
            }
            
            // 5. Contrast Enhancement: Boost alpha channel contrast
            if (contrastEnhancement > 0) {
                await processChunk(() => {
                    const factor = 1 + (contrastEnhancement / 50); // More aggressive (was /100)
                    const midpoint = 128;
                    
                    console.log(`🎨 Contrast Enhancement: factor=${factor.toFixed(2)}`);
                    let changedCount = 0;
                    
                    for (let i = 0; i < data.length; i += 4) {
                        const alpha = data[i + 3];
                        if (alpha > 0 && alpha < 255) {
                            // Apply contrast curve
                            const adjusted = midpoint + (alpha - midpoint) * factor;
                            const newAlpha = Math.max(0, Math.min(255, Math.round(adjusted)));
                            if (newAlpha !== alpha) changedCount++;
                            data[i + 3] = newAlpha;
                        }
                    }
                    console.log(`✅ Enhanced ${changedCount} pixels`);
                });
            }
            
            // 6. Edge Radius / Matte Edge: Additional edge refinement
            if (edgeRadius > 0 || matteEdge > 0) {
                await processChunk(() => {
                    const radius = Math.max(edgeRadius, matteEdge);
                    const tempData = new Uint8ClampedArray(data.length);
                    tempData.set(data);
                    
                    const r = Math.min(Math.round(radius / 2), 10);
                    
                    for (let y = r; y < height - r; y++) {
                        for (let x = r; x < width - r; x++) {
                            const idx = (y * width + x) * 4;
                            const alpha = data[idx + 3];
                            
                            // Only refine semi-transparent edges
                            if (alpha > 10 && alpha < 245) {
                                let sum = 0;
                                let count = 0;
                                
                                // Average in radius
                                for (let dy = -r; dy <= r; dy++) {
                                    for (let dx = -r; dx <= r; dx++) {
                                        const nIdx = ((y + dy) * width + (x + dx)) * 4 + 3;
                                        sum += data[nIdx];
                                        count++;
                                    }
                                }
                                
                                tempData[idx + 3] = Math.round(sum / count);
                            }
                        }
                    }
                    data.set(tempData);
                });
            }
            
            // 7. Corner Refinement: Preserve sharp corners while smoothing edges
            if (cornerRefinement > 0) {
                await processChunk(() => {
                    const tempData = new Uint8ClampedArray(data.length);
                    tempData.set(data);
                    const threshold = Math.max(30, cornerRefinement * 2); // More sensitive
                    
                    console.log(`📐 Corner Refinement: threshold=${threshold}`);
                    let preservedCount = 0;
                    
                    for (let y = 2; y < height - 2; y++) {
                        for (let x = 2; x < width - 2; x++) {
                            const idx = (y * width + x) * 4;
                            const alpha = data[idx + 3];
                            
                            if (alpha > 10 && alpha < 245) {
                                // Detect corner by checking angle changes
                                const left = data[(y * width + (x-1)) * 4 + 3];
                                const right = data[(y * width + (x+1)) * 4 + 3];
                                const top = data[((y-1) * width + x) * 4 + 3];
                                const bottom = data[((y+1) * width + x) * 4 + 3];
                                
                                const horizontalGrad = Math.abs(right - left);
                                const verticalGrad = Math.abs(bottom - top);
                                
                                // High gradient = edge/corner, preserve it
                                if (horizontalGrad > threshold || verticalGrad > threshold) {
                                    // Keep original alpha (preserve sharp features)
                                    tempData[idx + 3] = alpha;
                                    preservedCount++;
                                } else {
                                    // Smooth non-corner areas slightly
                                    const avg = (left + right + top + bottom) / 4;
                                    tempData[idx + 3] = Math.round((alpha * 0.7 + avg * 0.3));
                                }
                            }
                        }
                    }
                    data.set(tempData);
                    console.log(`✅ Preserved ${preservedCount} corner pixels`);
                });
            }
            
            // 8. SSAA (Supersampling Anti-Aliasing): Client-side implementation
            if (ssaaQuality > 0) {
                await processChunk(() => {
                    console.log(`🎯 Applying SSAA: quality=${ssaaQuality}%`);
                    const ssaaScale = 1 + (ssaaQuality / 100); // 0-100 -> 1.0-2.0x scale
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = Math.round(canvas.width * ssaaScale);
                    tempCanvas.height = Math.round(canvas.height * ssaaScale);
                    const tempCtx = tempCanvas.getContext('2d');
                    if (tempCtx) {
                        tempCtx.imageSmoothingEnabled = true;
                        tempCtx.imageSmoothingQuality = 'high';
                        // Draw current canvas at higher resolution
                        ctx.putImageData(imageData, 0, 0);
                        tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
                        // Draw back at original size with smoothing
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
                        // Re-read image data after SSAA
                        const newImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        data.set(newImageData.data);
                        console.log(`✅ SSAA applied at ${ssaaScale.toFixed(2)}x scale`);
                    }
                });
            }
            
            // 9. Decontamination: Remove color fringe from edges
            if (decontamination > 0) {
                await processChunk(() => {
                    console.log(`🧪 Applying Decontamination: strength=${decontamination}`);
                    const decontAmount = decontamination / 10; // 0-20 slider -> 0-2 range
                    let decontaminatedCount = 0;
                    
                    for (let y = 0; y < canvas.height; y++) {
                        for (let x = 0; x < canvas.width; x++) {
                            const idx = (y * canvas.width + x) * 4;
                            const alpha = data[idx + 3];
                            
                            // Only process semi-transparent edges (where color bleeding occurs)
                            if (alpha > 0 && alpha < 200) {
                                // Reduce color saturation near edges to remove fringe
                                const r = data[idx];
                                const g = data[idx + 1];
                                const b = data[idx + 2];
                                const gray = (r + g + b) / 3;
                                const factor = Math.min(1, decontAmount * (1 - alpha / 255));
                                data[idx] = Math.round(r + (gray - r) * factor);
                                data[idx + 1] = Math.round(g + (gray - g) * factor);
                                data[idx + 2] = Math.round(b + (gray - b) * factor);
                                decontaminatedCount++;
                            }
                        }
                    }
                    console.log(`✅ Decontaminated ${decontaminatedCount} edge pixels`);
                });
            }
            
            ctx.putImageData(imageData, 0, 0);
            const refinedDataUrl = canvas.toDataURL('image/png');
            
            // Update preview with refined result
            setPreviewImage(refinedDataUrl);
            
        } catch (e) {
            console.error('Client-side refinement failed', e);
        } finally {
            setIsProcessingPreview(false);
        }
    }, [
        upscaledImage, finalImage,
        chromaTolerance, chromaMode, customChroma, pickedChroma, detectedChroma,
        morphOp, morphIter,
        featherRadius, edgeChoke, cornerSmoothing, cornerRefinement, edgeSmoothing,
        borderCleanup, contrastEnhancement, edgeRadius, matteEdge,
        ssaaQuality, decontamination, artifactCleanupSize
    ]);
    
    // Helper: Fast box blur approximation (3x faster than Gaussian for large radius)
    const boxBlurAlpha = (alphaData: Float32Array, width: number, height: number, radius: number, outputData: Uint8ClampedArray) => {
        const diameter = radius * 2 + 1;
        const temp = new Float32Array(width * height);
        
        // Horizontal pass
        for (let y = 0; y < height; y++) {
            let sum = 0;
            // Initialize window
            for (let x = -radius; x <= radius; x++) {
                const nx = Math.max(0, Math.min(width - 1, x));
                sum += alphaData[y * width + nx];
            }
            
            for (let x = 0; x < width; x++) {
                temp[y * width + x] = sum / diameter;
                // Slide window
                const removeX = Math.max(0, x - radius);
                const addX = Math.min(width - 1, x + radius + 1);
                sum = sum - alphaData[y * width + removeX] + alphaData[y * width + addX];
            }
        }
        
        // Vertical pass
        for (let x = 0; x < width; x++) {
            let sum = 0;
            // Initialize window
            for (let y = -radius; y <= radius; y++) {
                const ny = Math.max(0, Math.min(height - 1, y));
                sum += temp[ny * width + x];
            }
            
            for (let y = 0; y < height; y++) {
                outputData[(y * width + x) * 4 + 3] = Math.round(sum / diameter);
                // Slide window
                const removeY = Math.max(0, y - radius);
                const addY = Math.min(height - 1, y + radius + 1);
                sum = sum - temp[removeY * width + x] + temp[addY * width + x];
            }
        }
    };
    
    // Helper: Create Gaussian kernel for blur
    const createGaussianKernel = (radius: number): Float32Array => {
        const size = radius * 2 + 1;
        const kernel = new Float32Array(size);
        const sigma = radius / 3;
        let sum = 0;
        
        for (let i = 0; i < size; i++) {
            const x = i - radius;
            kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
            sum += kernel[i];
        }
        
        // Normalize
        for (let i = 0; i < size; i++) {
            kernel[i] /= sum;
        }
        
        return kernel;
    };
    
    // SERVER-SIDE PREVIEW: Re-process with actual server logic for accurate preview
    const reprocessPreview = useCallback(async () => {
        if (!upscaledImage || isReprocessing) return;
        
        // Create new abort controller for this request
        previewAbortController.current = new AbortController();
        setIsProcessingPreview(true);
        setIsReprocessing(true); // Show loading indicator for heavy params
        
        try {
            // Call server with current settings to get accurate preview
            const previewUrl = await runProcessCutout(upscaledImage, false);
            
            // Update the displayed image
            setFinalImage(previewUrl);
            setPreviewImage(null); // Clear any old preview
            
        } catch (e: any) {
            // Ignore abort errors (user changed slider again)
            if (e.name !== 'AbortError') {
                console.error('Preview reprocessing failed', e);
            }
        } finally {
            setIsProcessingPreview(false);
            setIsReprocessing(false); // Hide loading indicator
        }
    }, [
        upscaledImage,
        isReprocessing,
        chromaTolerance,
        featherRadius,
        chromaMode,
        customChroma,
        edgeEnhancement,
        edgeSmoothing,
        antiAliasing,
        colorBleedPrevention,
        adaptiveFeathering,
        borderCleanup,
        contrastEnhancement,
        edgeRadius,
        smartRadius,
        matteEdge,
        protectBlacks,
        edgeChoke,
        cornerSmoothing,
        cornerRefinement,
        artifactCleanupSize,
        ssaaQuality,
        decontamination,
        morphOp,
        morphIter,
        runProcessCutout
    ]);
    
    const generateClientPreview = useCallback(async () => {
        if (!upscaledImage) return;
        
        const currentParams = `${chromaTolerance}-${featherRadius}`;
        if (currentParams === lastPreviewParamsRef.current) return; // No change
        lastPreviewParamsRef.current = currentParams;
        
        setIsProcessingPreview(true);
        
        try {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = upscaledImage;
            });
            
            // Create offscreen canvas for processing
            const canvas = document.createElement('canvas');
            const targetWidth = Math.min(img.naturalWidth, 1200); // Limit preview size for performance
            const targetHeight = (targetWidth / img.naturalWidth) * img.naturalHeight;
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;
            
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
            const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            const data = imageData.data;
            
            // CACHE-BASED PROCESSING: Reuse mask if tolerance hasn't changed significantly
            let maskData = cachedMaskDataRef.current;
            
            // Detect chroma color (same logic as server)
            let chromaToUse = { r: 255, g: 0, b: 255 };
            if (chromaMode === 'custom') {
                chromaToUse = pickedChroma || customChroma;
            } else {
                // Quick edge sampling for auto-detect
                const sample = (x: number, y: number) => {
                    const idx = (y * targetWidth + x) * 4;
                    return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
                };
                chromaToUse = sample(Math.floor(targetWidth / 2), 0); // Top center
            }
            
            // Fast chroma key removal (simplified algorithm)
            const tolerance = chromaTolerance / 100;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // Calculate color distance to chroma
                const dr = (r - chromaToUse.r) / 255;
                const dg = (g - chromaToUse.g) / 255;
                const db = (b - chromaToUse.b) / 255;
                const distance = Math.sqrt(dr * dr + dg * dg + db * db);
                
                // Apply threshold with soft edge
                if (distance < tolerance) {
                    const alpha = distance / tolerance; // Soft edge
                    data[i + 3] = Math.floor(alpha * 255);
                } else {
                    data[i + 3] = 255; // Keep opaque
                }
            }
            
            // REGION-BASED FEATHERING: Only process edges (performance optimization)
            if (featherRadius > 0) {
                const radius = Math.min(featherRadius, 20); // Limit for performance
                // Simple box blur on alpha channel
                for (let y = 0; y < targetHeight; y++) {
                    for (let x = 0; x < targetWidth; x++) {
                        const idx = (y * targetWidth + x) * 4;
                        const alpha = data[idx + 3];
                        
                        // Only blur edges (skip fully opaque/transparent)
                        if (alpha > 10 && alpha < 245) {
                            let sum = 0, count = 0;
                            for (let dy = -radius; dy <= radius; dy++) {
                                for (let dx = -radius; dx <= radius; dx++) {
                                    const nx = x + dx;
                                    const ny = y + dy;
                                    if (nx >= 0 && nx < targetWidth && ny >= 0 && ny < targetHeight) {
                                        const nidx = (ny * targetWidth + nx) * 4;
                                        sum += data[nidx + 3];
                                        count++;
                                    }
                                }
                            }
                            data[idx + 3] = Math.floor(sum / count);
                        }
                    }
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
            const previewDataUrl = canvas.toDataURL('image/png');
            
            // Cache mask data for reuse
            cachedMaskDataRef.current = imageData;
            
            // Update preview image
            setPreviewImage(previewDataUrl);
            
        } catch (e) {
            console.error('Client preview generation failed', e);
        } finally {
            setIsProcessingPreview(false);
        }
    }, [upscaledImage, chromaTolerance, featherRadius, chromaMode, pickedChroma, customChroma]);

    // Redraw polygon canvas when penPoints change - Adobe Illustrator style
    useEffect(() => {
        if (!isPenErasing || !polygonContainerRef.current) return;
        
        const redrawCanvas = () => {
            if (!polygonContainerRef.current) return;
            const canvasOverlay = polygonContainerRef.current.querySelector('canvas.polygon-overlay') as HTMLCanvasElement;
            const imgElement = polygonContainerRef.current.querySelector('img');
            if (!canvasOverlay || !imgElement) return;
            
            const imgRect = imgElement.getBoundingClientRect();
            const parentRect = polygonContainerRef.current.getBoundingClientRect();
            
            const dpr = window.devicePixelRatio || 1;
            const canvasWidth = imgRect.width;
            const canvasHeight = imgRect.height;
            
            // Only update canvas if size actually changed
            if (canvasOverlay.width !== canvasWidth * dpr || canvasOverlay.height !== canvasHeight * dpr) {
                canvasOverlay.width = canvasWidth * dpr;
                canvasOverlay.height = canvasHeight * dpr;
                canvasOverlay.style.width = `${canvasWidth}px`;
                canvasOverlay.style.height = `${canvasHeight}px`;
            }
            
            canvasOverlay.style.left = `${imgRect.left - parentRect.left}px`;
            canvasOverlay.style.top = `${imgRect.top - parentRect.top}px`;
            
            const ctx = canvasOverlay.getContext('2d');
            if (!ctx) return;
            
            // Reset transform before scaling to prevent accumulation
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            
            if (penPoints.length === 0 && !currentMousePos) return;
            
            // Adobe Illustrator colors
            const AI_BLUE = '#2196F3';
            const AI_ORANGE = '#FF9800';
            const AI_PATH_FILL = 'rgba(33, 150, 243, 0.15)';
            
            // Draw filled polygon with Bezier curves
            if (penPoints.length >= 2) {
                ctx.beginPath();
                penPoints.forEach((point, i) => {
                    const x = point.x * imgRect.width;
                    const y = point.y * imgRect.height;
                    
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        const prevPoint = penPoints[i - 1];
                        
                        // Use Bezier curve if both handles exist
                        if (prevPoint.cp2 && point.cp1) {
                            const cp1x = prevPoint.cp2.x * imgRect.width;
                            const cp1y = prevPoint.cp2.y * imgRect.height;
                            const cp2x = point.cp1.x * imgRect.width;
                            const cp2y = point.cp1.y * imgRect.height;
                            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
                        } else if (prevPoint.cp2) {
                            // Only outgoing handle from previous point
                            const cpx = prevPoint.cp2.x * imgRect.width;
                            const cpy = prevPoint.cp2.y * imgRect.height;
                            ctx.quadraticCurveTo(cpx, cpy, x, y);
                        } else if (point.cp1) {
                            // Only incoming handle to current point
                            const cpx = point.cp1.x * imgRect.width;
                            const cpy = point.cp1.y * imgRect.height;
                            const prevX = prevPoint.x * imgRect.width;
                            const prevY = prevPoint.y * imgRect.height;
                            // Use quadratic from prev point
                            ctx.quadraticCurveTo(cpx, cpy, x, y);
                        } else {
                            // Straight line (corner points)
                            ctx.lineTo(x, y);
                        }
                    }
                });
                
                // Draw line to mouse if hovering
                if (currentMousePos && !isNearFirstPoint && penPoints.length > 0) {
                    const lastPoint = penPoints[penPoints.length - 1];
                    if (lastPoint.cp2) {
                        // Draw curve preview
                        const cpx = lastPoint.cp2.x * imgRect.width;
                        const cpy = lastPoint.cp2.y * imgRect.height;
                        ctx.quadraticCurveTo(cpx, cpy, currentMousePos.x, currentMousePos.y);
                    } else {
                        ctx.lineTo(currentMousePos.x, currentMousePos.y);
                    }
                }
                
                // Close path if near first point
                if (isNearFirstPoint && penPoints.length >= 3) {
                    // Draw closing curve if last point has outgoing handle
                    const lastPoint = penPoints[penPoints.length - 1];
                    const firstPoint = penPoints[0];
                    if (lastPoint.cp2 && firstPoint.cp1) {
                        const cp1x = lastPoint.cp2.x * imgRect.width;
                        const cp1y = lastPoint.cp2.y * imgRect.height;
                        const cp2x = firstPoint.cp1.x * imgRect.width;
                        const cp2y = firstPoint.cp1.y * imgRect.height;
                        const fx = firstPoint.x * imgRect.width;
                        const fy = firstPoint.y * imgRect.height;
                        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, fx, fy);
                    } else {
                        ctx.closePath();
                    }
                }
                
                // Fill with Adobe Illustrator style
                ctx.fillStyle = AI_PATH_FILL;
                ctx.fill();
                
                // Stroke the path
                ctx.strokeStyle = AI_BLUE;
                ctx.lineWidth = 1.5;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.stroke();
            }
            
            // Draw preview line from last point to mouse
            if (penPoints.length > 0 && currentMousePos && !isNearFirstPoint) {
                const last = penPoints[penPoints.length - 1];
                ctx.beginPath();
                ctx.moveTo(last.x * imgRect.width, last.y * imgRect.height);
                ctx.lineTo(currentMousePos.x, currentMousePos.y);
                ctx.strokeStyle = AI_BLUE;
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            
            // Draw closing dashed line if near first point
            if (penPoints.length >= 3 && isNearFirstPoint) {
                const last = penPoints[penPoints.length - 1];
                const first = penPoints[0];
                ctx.beginPath();
                ctx.moveTo(last.x * imgRect.width, last.y * imgRect.height);
                ctx.lineTo(first.x * imgRect.width, first.y * imgRect.height);
                ctx.strokeStyle = AI_BLUE;
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            
            // Draw anchor points - Adobe Illustrator style
            penPoints.forEach((point, i) => {
                const x = point.x * imgRect.width;
                const y = point.y * imgRect.height;
                
                const isHovered = hoveredPointIndex === i;
                const isFirst = i === 0;
                const isNearFirst = isFirst && isNearFirstPoint && penPoints.length >= 3;
                
                // Outer square (white background)
                ctx.fillStyle = 'white';
                ctx.strokeStyle = isHovered || isNearFirst ? AI_ORANGE : AI_BLUE;
                ctx.lineWidth = isHovered || isNearFirst ? 2 : 1.5;
                
                ctx.beginPath();
                const size = isHovered || isNearFirst ? 7 : 6;
                ctx.rect(x - size/2, y - size/2, size, size);
                ctx.fill();
                ctx.stroke();
                
                // Inner square for first/last points
                if (isFirst || i === penPoints.length - 1) {
                    ctx.fillStyle = isNearFirst ? AI_ORANGE : AI_BLUE;
                    const innerSize = 3;
                    ctx.fillRect(x - innerSize/2, y - innerSize/2, innerSize, innerSize);
                }
                
                // Draw control handles if they exist (Bezier curves)
                // Only show handles when hovering, ctrl-selecting, or for the last point
                const showHandles = isHovered || isFirst || i === penPoints.length - 1 || isCtrlPressed;
                
                if (showHandles && point.cp1) {
                    const cp1x = point.cp1.x * imgRect.width;
                    const cp1y = point.cp1.y * imgRect.height;
                    
                    // Draw control line
                    ctx.strokeStyle = AI_BLUE;
                    ctx.lineWidth = 1;
                    ctx.setLineDash([2, 2]);
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(cp1x, cp1y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    
                    // Draw control handle (small circle) - highlight if hovered
                    const isHandleHovered = hoveredHandleInfo?.pointIndex === i && hoveredHandleInfo?.handleType === 'cp1';
                    ctx.fillStyle = 'white';
                    ctx.strokeStyle = isHandleHovered ? AI_ORANGE : AI_BLUE;
                    ctx.lineWidth = isHandleHovered ? 2 : 1.5;
                    ctx.beginPath();
                    ctx.arc(cp1x, cp1y, isHandleHovered ? 5 : 4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
                
                if (showHandles && point.cp2) {
                    const cp2x = point.cp2.x * imgRect.width;
                    const cp2y = point.cp2.y * imgRect.height;
                    
                    // Draw control line
                    ctx.strokeStyle = AI_BLUE;
                    ctx.lineWidth = 1;
                    ctx.setLineDash([2, 2]);
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(cp2x, cp2y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    
                    // Draw control handle (small circle) - highlight if hovered
                    const isHandleHovered = hoveredHandleInfo?.pointIndex === i && hoveredHandleInfo?.handleType === 'cp2';
                    ctx.fillStyle = 'white';
                    ctx.strokeStyle = isHandleHovered ? AI_ORANGE : AI_BLUE;
                    ctx.lineWidth = isHandleHovered ? 2 : 1.5;
                    ctx.beginPath();
                    ctx.arc(cp2x, cp2y, isHandleHovered ? 5 : 4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
            });
            
            // Draw mouse cursor anchor preview
            if (currentMousePos && !isNearFirstPoint && penPoints.length > 0) {
                ctx.fillStyle = 'white';
                ctx.strokeStyle = AI_BLUE;
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.6;
                
                ctx.beginPath();
                const size = 5;
                ctx.rect(currentMousePos.x - size/2, currentMousePos.y - size/2, size, size);
                ctx.fill();
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
            
            // Draw brush/eraser strokes
            if (brushStrokes.length > 0) {
                brushStrokes.forEach(stroke => {
                    if (stroke.type === 'brush') {
                        ctx.strokeStyle = stroke.color || '#FF0000';
                        ctx.globalAlpha = stroke.opacity || 1;
                    } else {
                        // Eraser - show as semi-transparent white
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                        ctx.globalAlpha = 0.7;
                    }
                    
                    ctx.lineWidth = stroke.size * Math.max(imgRect.width, imgRect.height) / 1000;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    
                    ctx.beginPath();
                    stroke.points.forEach((p, i) => {
                        const px = p.x * imgRect.width;
                        const py = p.y * imgRect.height;
                        if (i === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    });
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                });
            }
        };
        
        redrawCanvas();
        window.addEventListener('resize', redrawCanvas);
        return () => window.removeEventListener('resize', redrawCanvas);
    }, [penPoints, isPenErasing, hoveredPointIndex, hoveredHandleInfo, isNearFirstPoint, currentMousePos, isCtrlPressed]);

    // Mouse move handler for pen tool - Adobe Illustrator style cursor tracking
    const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (!isPenErasing || !polygonContainerRef.current) return;
        
        const imgElement = polygonContainerRef.current.querySelector('img');
        if (!imgElement) return;
        
        const imgRect = imgElement.getBoundingClientRect();
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        
        // Check if mouse is within image bounds
        if (mouseX < imgRect.left || mouseX > imgRect.right || 
            mouseY < imgRect.top || mouseY > imgRect.bottom) {
            setCurrentMousePos(null);
            setHoveredPointIndex(null);
            setIsNearFirstPoint(false);
            return;
        }
        
        // Store current mouse position relative to image
        const relX = mouseX - imgRect.left;
        const relY = mouseY - imgRect.top;
        setCurrentMousePos({ x: relX, y: relY });
        
        // Check if hovering near any anchor point
        const hoverThreshold = 8; // pixels
        let nearPointIndex: number | null = null;
        
        for (let i = 0; i < penPoints.length; i++) {
            const point = penPoints[i];
            const pointX = point.x * imgRect.width;
            const pointY = point.y * imgRect.height;
            const distance = Math.sqrt(
                Math.pow(relX - pointX, 2) + 
                Math.pow(relY - pointY, 2)
            );
            
            if (distance <= hoverThreshold) {
                nearPointIndex = i;
                break;
            }
        }
        
        setHoveredPointIndex(nearPointIndex);
        
        // Check if near first point (to show close path cursor)
        if (penPoints.length >= 3 && nearPointIndex === 0) {
            setIsNearFirstPoint(true);
        } else {
            setIsNearFirstPoint(false);
        }
    }, [isPenErasing, penPoints]);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (file) {
            handleFile(file);
        }
    }, []);

    const handleFile = (file: File) => {
        setPendingFile(file);
        setShowModelSelection(true);
    };

    const startProcessing = async () => {
        if (!pendingFile) return;
        
        setShowModelSelection(false);
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            if (typeof event.target?.result === 'string') {
                const imageUrl = event.target.result;
                setOriginalImage(imageUrl);
                setStep('cloning');

                try {
                    const imagePart = await dataUrlToPart(imageUrl);
                    let result: { newImageBase64s?: string[]; text?: string; error?: string };
                    const prompt = getCloneDesignPrompt({ chromaHex: promptChromaHex });
                    if (selectedPatternModel === 'openai') {
                        result = await generateImageOpenAI([imagePart, { text: prompt }], 1);
                    } else {
                        result = await generateImageFromParts([imagePart, { text: prompt }], 1);
                    }

                    if (result.error || !result.newImageBase64s || result.newImageBase64s.length === 0) {
                        throw new Error(result.error || "AI failed to clone the design.");
                    }

                    const clonedImageUrl = `data:image/png;base64,${result.newImageBase64s[0]}`;
                    setClonedImage(clonedImageUrl);
                    
                    // STEP 1: Crop sát thiết kế TRƯỚC khi upscale để tối ưu
                    setStep('detecting');
                    const croppedImageUrl = await detectAndCropPattern(clonedImageUrl);
                    
                    // STEP 2: Rotate image if angle is set
                    let rotatedImageUrl = croppedImageUrl;
                    if (rotationAngle !== 0) {
                        console.log(`🔄 Applying rotation: ${rotationAngle.toFixed(2)}°`);
                        rotatedImageUrl = await rotateImage(croppedImageUrl, rotationAngle);
                    }
                    
                    // STEP 3: Upscale ảnh đã crop và rotate (model name determines scale: x4 or x2)
                    setStep('upscaling');
                    const upscaledImageUrl = await upscaleImageViaCloud(rotatedImageUrl, selectedUpscaleModel);
                    
                    // STEP 4: Resize về kích thước chuẩn 4500x5100px (T-shirt template size)
                    setStep('resizing');
                    const resizedImageUrl = await resizeToStandardSize(upscaledImageUrl, 4500, 5100);
                    setUpscaledImage(resizedImageUrl);

                    // Set flag BEFORE setting final image to prevent double execution
                    setIsInitialProcessing(true);

                    // STEP 5: Process cutout to refine edges and remove background artifacts
                    setStep('processing');
                    const processedDataUrl = await runProcessCutout(resizedImageUrl, false);
                    setFinalImage(processedDataUrl);
                    setTuningDirty(false); // initial final matches current tuning
                    setIsReprocessing(false); // Ensure spinner stops
                    setIsImageReady(true); // Mark image as ready
                    if (zoomableImageRef.current) zoomableImageRef.current.resetZoom(); // reset zoom on new final image
                    
                    // Save initial state to undo history (track the final layer)
                    setUndoHistory([processedDataUrl]);
                    setCurrentHistoryIndex(0);
                    
                    setStep('done');

                    // Clear flag AFTER a short delay to allow effect to register the state
                    setTimeout(() => {
                        setIsInitialProcessing(false);
                    }, 500);

                } catch (error) {
                    console.error("Cloning failed:", error);
                    alert("Sorry, the design cloning failed. Please try again.");
                    reset();
                }
            }
        };
        reader.readAsDataURL(pendingFile);
        setPendingFile(null);
    };

    /**
     * Rotate image by specified angle (in degrees)
     * Positive = clockwise, Negative = counter-clockwise
     */
    const rotateImage = async (imageDataUrl: string, angle: number): Promise<string> => {
        if (angle === 0) return imageDataUrl;
        
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve(imageDataUrl);
                        return;
                    }
                    
                    // Convert angle to radians
                    const angleRad = (angle * Math.PI) / 180;
                    
                    // Calculate bounding box for rotated image
                    const cos = Math.abs(Math.cos(angleRad));
                    const sin = Math.abs(Math.sin(angleRad));
                    const newWidth = Math.ceil(img.width * cos + img.height * sin);
                    const newHeight = Math.ceil(img.width * sin + img.height * cos);
                    
                    canvas.width = newWidth;
                    canvas.height = newHeight;
                    
                    // Move to center, rotate, then draw
                    ctx.translate(newWidth / 2, newHeight / 2);
                    ctx.rotate(angleRad);
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, -img.width / 2, -img.height / 2);
                    
                    console.log(`🔄 Rotated ${angle.toFixed(2)}° (${img.width}x${img.height} → ${newWidth}x${newHeight})`);
                    resolve(canvas.toDataURL('image/png'));
                } catch (e) {
                    console.error('Rotation failed:', e);
                    resolve(imageDataUrl);
                }
            };
            
            img.onerror = () => {
                console.error('Image load failed for rotation');
                resolve(imageDataUrl);
            };
            img.src = imageDataUrl;
        });
    };

    // Resize image to standard T-shirt template size (4500x5100px)
    // Maintains aspect ratio by fitting within bounds and centering on transparent background
    const resizeToStandardSize = async (imageDataUrl: string, targetWidth: number, targetHeight: number): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve(imageDataUrl);
                        return;
                    }
                    
                    // Set canvas to standard size
                    canvas.width = targetWidth;
                    canvas.height = targetHeight;
                    
                    // Calculate scaling to fit within bounds while maintaining aspect ratio
                    const scaleX = targetWidth / img.width;
                    const scaleY = targetHeight / img.height;
                    const scale = Math.min(scaleX, scaleY); // Fit within bounds
                    
                    const scaledWidth = img.width * scale;
                    const scaledHeight = img.height * scale;
                    
                    // Center the image on canvas
                    const offsetX = (targetWidth - scaledWidth) / 2;
                    const offsetY = (targetHeight - scaledHeight) / 2;
                    
                    // Draw with high quality
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
                    
                    console.log(`📐 Resized from ${img.width}x${img.height} to ${targetWidth}x${targetHeight} (scaled: ${scaledWidth.toFixed(0)}x${scaledHeight.toFixed(0)})`);
                    resolve(canvas.toDataURL('image/png'));
                } catch (e) {
                    console.error('Resize failed:', e);
                    resolve(imageDataUrl);
                }
            };
            
            img.onerror = () => {
                console.error('Image load failed for resize');
                resolve(imageDataUrl);
            };
            img.src = imageDataUrl;
        });
    };

    // Detect pattern boundaries and crop to maximize design (chroma-distance aware)
    const detectAndCropPattern = async (imageDataUrl: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve(imageDataUrl);
                        return;
                    }
                    
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    // Estimate chroma from top-center (priority), fallback to edges
                    const sample = (sx: number, sy: number) => {
                        const i = (sy * canvas.width + sx) * 4;
                        return { r: data[i], g: data[i + 1], b: data[i + 2] };
                    };
                    const centerX = Math.floor(canvas.width / 2);
                    const topCenter = sample(centerX, 4);
                    const candidates = [
                        topCenter,
                        sample(centerX, canvas.height - 4),
                        sample(2, Math.floor(canvas.height / 2)),
                        sample(canvas.width - 4, Math.floor(canvas.height / 2)),
                        sample(2, 2),
                        sample(canvas.width - 4, 2)
                    ];
                    const bgCandidate = candidates.reduce((best, cur) => {
                        const sum = cur.r + cur.g + cur.b;
                        const bestSum = best.r + best.g + best.b;
                        return (sum < 15 || sum > 700) ? best : (bestSum < 15 || bestSum > 700 ? cur : best);
                    }, candidates[0]);
                    const bg = bgCandidate || { r: 255, g: 0, b: 255 };

                    const dist2 = (r1:number,g1:number,b1:number,r2:number,g2:number,b2:number)=>{
                        const dr=r1-r2,dg=g1-g2,db=b1-b2;return dr*dr+dg*dg+db*db;
                    };
                    const chromaThresh = 40*40; // distance threshold

                    // Find bounding box of non-chroma pixels using distance to bg
                    let minX = canvas.width;
                    let minY = canvas.height;
                    let maxX = 0;
                    let maxY = 0;
                    let patternPixelCount = 0;
                    
                    for (let y = 0; y < canvas.height; y++) {
                        for (let x = 0; x < canvas.width; x++) {
                            const i = (y * canvas.width + x) * 4;
                            const r = data[i];
                            const g = data[i + 1];
                            const b = data[i + 2];
                            const a = data[i + 3];
                            const nearBg = dist2(r,g,b,bg.r,bg.g,bg.b) < chromaThresh;
                            const isBackground = nearBg || a < 50;
                            
                            if (!isBackground) {
                                patternPixelCount++;
                                if (x < minX) minX = x;
                                if (x > maxX) maxX = x;
                                if (y < minY) minY = y;
                                if (y > maxY) maxY = y;
                            }
                        }
                    }
                    
                    // Check if we found enough pattern pixels (at least 5% of image)
                    const totalPixels = canvas.width * canvas.height;
                    const patternRatio = patternPixelCount / totalPixels;
                    
                    if (patternRatio < 0.05 || patternPixelCount < 100) {
                        // Pattern too small, return original
                        console.log('Pattern too small, keeping original size');
                        resolve(imageDataUrl);
                        return;
                    }
                    
                    // Add smart padding based on pattern size
                    const patternWidth = maxX - minX;
                    const patternHeight = maxY - minY;
                    const paddingPercent = 0.15; // 15% padding
                    const paddingX = patternWidth * paddingPercent;
                    const paddingY = patternHeight * paddingPercent;
                    
                    minX = Math.max(0, Math.floor(minX - paddingX));
                    minY = Math.max(0, Math.floor(minY - paddingY));
                    maxX = Math.min(canvas.width, Math.ceil(maxX + paddingX));
                    maxY = Math.min(canvas.height, Math.ceil(maxY + paddingY));
                    
                    const cropWidth = maxX - minX;
                    const cropHeight = maxY - minY;
                    
                    // Calculate crop efficiency
                    const originalArea = canvas.width * canvas.height;
                    const croppedArea = cropWidth * cropHeight;
                    const cropRatio = croppedArea / originalArea;
                    
                    console.log(`Pattern detected: ${patternRatio.toFixed(2)}% of image, crop saves ${((1-cropRatio)*100).toFixed(1)}% space`);
                    
                    // Only crop if it saves at least 15% space
                    if (cropRatio < 0.85) {
                        const croppedCanvas = document.createElement('canvas');
                        const croppedCtx = croppedCanvas.getContext('2d');
                        if (!croppedCtx) {
                            resolve(imageDataUrl);
                            return;
                        }
                        
                        croppedCanvas.width = cropWidth;
                        croppedCanvas.height = cropHeight;
                        
                        // Draw cropped region
                        croppedCtx.drawImage(
                            canvas,
                            minX, minY, cropWidth, cropHeight,
                            0, 0, cropWidth, cropHeight
                        );
                        
                        console.log(`Cropped from ${canvas.width}x${canvas.height} to ${cropWidth}x${cropHeight}`);
                        resolve(croppedCanvas.toDataURL('image/png'));
                    } else {
                        // Not worth cropping, return original
                        console.log('Crop not significant enough, keeping original');
                        resolve(imageDataUrl);
                    }
                } catch (e) {
                    console.error('Pattern detection failed:', e);
                    resolve(imageDataUrl); // fallback on error
                }
            };
            
            img.onerror = () => {
                console.error('Image load failed for pattern detection');
                resolve(imageDataUrl);
            };
            img.src = imageDataUrl;
        });
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] }, multiple: false, onDragEnter: () => {}, onDragOver: () => {}, onDragLeave: () => {} });

    // ESC key to cancel chroma picker mode
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isPickingChroma) {
                setIsPickingChroma(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPickingChroma]);

    const handlePaste = (event: React.ClipboardEvent) => {
        const items = event.clipboardData?.items;
        if (items) {
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        handleFile(file);
                    }
                }
            }
        }
    };

    // Save current state to undo history
    const saveToHistory = useCallback((imageUrl: string) => {
        console.log('💾 Saving to undo history');
        setUndoHistory(prev => [...prev, imageUrl].slice(-20)); // Keep last 20 states
        setRedoHistory([]); // Clear redo stack when new action performed
        setCurrentHistoryIndex(prev => prev + 1);
    }, []);

    // Undo to previous state
    const undo = useCallback(() => {
        if (undoHistory.length === 0) {
            console.log('⚠️ Nothing to undo');
            setToast('↶ Nothing to undo');
            setTimeout(() => setToast(null), 1500);
            return;
        }
        
        console.log(`⬅️ Undo (stack size: ${undoHistory.length})`);
        
        // Save current state to redo before undoing
        const currentImage = finalImage || previewImage || upscaledImage;
        if (currentImage) {
            setRedoHistory(prev => [...prev, currentImage].slice(0, 20));
        }
        
        // Pop from undo stack
        const previousImage = undoHistory[undoHistory.length - 1];
        setUndoHistory(prev => prev.slice(0, -1));
        
        // Restore previous image
        setFinalImage(previousImage);
        setPreviewImage(null);
        setTuningDirty(false);
        
        // Clear any active tools/edits
        setPenPoints([]);
        setBrushStrokes([]);
        setActiveTool(null);
        setIsPenErasing(false);
        
        setToast('↶ Undo');
        setTimeout(() => setToast(null), 1500);
    }, [undoHistory, finalImage, previewImage, upscaledImage]);

    const redo = useCallback(() => {
        if (redoHistory.length === 0) {
            console.log('⚠️ Nothing to redo');
            setToast('↷ Nothing to redo');
            setTimeout(() => setToast(null), 1500);
            return;
        }
        
        console.log(`➡️ Redo (stack size: ${redoHistory.length})`);
        
        // Save current state to undo before redoing
        const currentImage = finalImage || previewImage || upscaledImage;
        if (currentImage) {
            setUndoHistory(prev => [...prev, currentImage].slice(0, 20));
        }
        
        // Pop from redo stack
        const nextImage = redoHistory[redoHistory.length - 1];
        setRedoHistory(prev => prev.slice(0, -1));
        
        // Restore next image
        setFinalImage(nextImage);
        setPreviewImage(null);
        setTuningDirty(false);
        
        // Clear any active tools/edits
        setPenPoints([]);
        setBrushStrokes([]);
        setActiveTool(null);
        setIsPenErasing(false);
        
        setToast('↷ Redo');
        setTimeout(() => setToast(null), 1500);
    }, [redoHistory, finalImage, previewImage, upscaledImage]);

    // Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z (redo), Ctrl+Y (redo)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Undo: Ctrl+Z (Windows) or Cmd+Z (Mac)
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
            
            // Redo: Ctrl+Shift+Z (Windows) or Cmd+Shift+Z (Mac)
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                redo();
            }
            
            // Alternative Redo: Ctrl+Y (Windows standard)
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    // Apply pen eraser - send polygon to erase (make transparent)
    const applyPenEraser = useCallback(async () => {
        const sourceImage = previewImage || finalImage || upscaledImage;
        if (penPoints.length < 3 || !sourceImage) {
            alert('Please draw at least 3 points to create a polygon');
            return;
        }
        
        // CRITICAL: Block refinement during tool application
        setIsApplyingTool(true);
        
        // CRITICAL: Cancel any pending refinement to prevent override
        if (refinementTimeoutRef.current) {
            clearTimeout(refinementTimeoutRef.current);
            refinementTimeoutRef.current = null;
            console.log('🛑 Cancelled pending refinement before applying pen tool');
        }
        
        // Save to history before applying
        saveToHistory(sourceImage);
        
        setIsReprocessing(true);
        try {
            // Create a canvas to apply transparency mask
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = sourceImage as string;
            });
            
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');
            
            // Draw original image
            ctx.drawImage(img, 0, 0);
            
            // Apply transparency mask using pen path
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'black';
            ctx.beginPath();
            
            penPoints.forEach((point, i) => {
                const x = point.x * canvas.width;
                const y = point.y * canvas.height;
                if (i === 0) ctx.moveTo(x, y);
                else {
                    const prevPoint = penPoints[i - 1];
                    
                    if (prevPoint.cp2 && point.cp1) {
                        const cp1x = prevPoint.cp2.x * canvas.width;
                        const cp1y = prevPoint.cp2.y * canvas.height;
                        const cp2x = point.cp1.x * canvas.width;
                        const cp2y = point.cp1.y * canvas.height;
                        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
                    } else if (prevPoint.cp2) {
                        const cpx = prevPoint.cp2.x * canvas.width;
                        const cpy = prevPoint.cp2.y * canvas.height;
                        ctx.quadraticCurveTo(cpx, cpy, x, y);
                    } else if (point.cp1) {
                        const cpx = point.cp1.x * canvas.width;
                        const cpy = point.cp1.y * canvas.height;
                        ctx.quadraticCurveTo(cpx, cpy, x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
            });
            
            ctx.closePath();
            ctx.fill();
            
            // Apply brush strokes if any
            if (brushStrokes.length > 0) {
                brushStrokes.forEach(stroke => {
                    if (stroke.type === 'eraser') {
                        ctx.globalCompositeOperation = 'destination-out';
                    } else {
                        ctx.globalCompositeOperation = 'source-over';
                        ctx.strokeStyle = stroke.color || '#FF0000';
                        ctx.globalAlpha = stroke.opacity || 1;
                    }
                    
                    ctx.lineWidth = stroke.size;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    
                    ctx.beginPath();
                    stroke.points.forEach((p, i) => {
                        const px = p.x * canvas.width;
                        const py = p.y * canvas.height;
                        if (i === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    });
                    ctx.stroke();
                });
            }
            
            const processedDataUrl = canvas.toDataURL('image/png');
            // Commit edits to finalImage and clear preview
            setFinalImage(processedDataUrl);
            setPreviewImage(null);
            setTuningDirty(false);
            
            // Clear pen points and brush strokes, exit pen mode
            setPenPoints([]);
            setBrushStrokes([]);
            setIsPenErasing(false);
            setActiveTool(null);
            
            // CRITICAL: Keep block active briefly to prevent immediate refinement
            setTimeout(() => {
                setIsApplyingTool(false);
                console.log('✅ Tool application complete - refinement unblocked');
            }, 300); // Small delay to ensure state updates propagate
            
            setToast('Transparency applied successfully');
            setTimeout(() => setToast(null), 3000);
        } catch (e) {
            console.error('Pen eraser failed', e);
            alert('Failed to apply transparency');
            setIsApplyingTool(false); // Unblock on error
        } finally {
            setIsReprocessing(false);
        }
    }, [penPoints, brushStrokes, finalImage, upscaledImage, previewImage, saveToHistory]);

    // Apply brush/eraser strokes only (no pen path)
    const applyBrushStrokes = useCallback(async () => {
        const sourceImage = previewImage || finalImage || upscaledImage;
        if (brushStrokes.length === 0 || !sourceImage) {
            alert('Please draw something first');
            return;
        }
        
        // CRITICAL: Block refinement during tool application
        setIsApplyingTool(true);
        
        // CRITICAL: Cancel any pending refinement to prevent override
        if (refinementTimeoutRef.current) {
            clearTimeout(refinementTimeoutRef.current);
            refinementTimeoutRef.current = null;
            console.log('🛑 Cancelled pending refinement before applying brush strokes');
        }
        
        // Save to history before applying
        saveToHistory(sourceImage);
        
        setIsReprocessing(true);
        try {
            // Create a canvas to apply brush strokes
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = sourceImage as string;
            });
            
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');
            
            // Draw original image
            ctx.drawImage(img, 0, 0);
            
            // Apply brush strokes
            brushStrokes.forEach(stroke => {
                if (stroke.type === 'eraser') {
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.strokeStyle = 'black';
                    ctx.globalAlpha = 1;
                } else {
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.strokeStyle = stroke.color || '#FF0000';
                    ctx.globalAlpha = stroke.opacity || 1;
                }
                
                ctx.lineWidth = stroke.size;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                ctx.beginPath();
                stroke.points.forEach((p, i) => {
                    const px = p.x * canvas.width;
                    const py = p.y * canvas.height;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                });
                ctx.stroke();
                ctx.globalAlpha = 1;
            });
            
            // Convert to data URL and commit to final, clear preview
            const processedDataUrl = canvas.toDataURL('image/png');
            setFinalImage(processedDataUrl);
            setPreviewImage(null);
            setTuningDirty(false);
            
            // Reset brush strokes
            setBrushStrokes([]);
            setActiveTool(null);
            
            // CRITICAL: Keep block active briefly to prevent immediate refinement
            setTimeout(() => {
                setIsApplyingTool(false);
                console.log('✅ Brush tool application complete - refinement unblocked');
            }, 300);
            
            setToast('Brush strokes applied successfully');
            setTimeout(() => setToast(null), 3000);
        } catch (e) {
            console.error('Brush strokes failed', e);
            alert('Failed to apply brush strokes');
            setIsApplyingTool(false); // Unblock on error
        } finally {
            setIsReprocessing(false);
        }
    }, [brushStrokes, finalImage, upscaledImage, previewImage, saveToHistory]);

    // Cancel pen eraser
    const cancelPenEraser = useCallback(() => {
        setPenPoints([]);
        setBrushStrokes([]);
        setIsPenErasing(false);
        setActiveTool(null);
        setHoveredPointIndex(null);
        setHoveredHandleInfo(null);
        setIsNearFirstPoint(false);
        setCurrentMousePos(null);
        setIsDraggingAnchor(null);
        setIsDraggingHandle(false);
        setIsDrawingHandle(false);
        setDragStartPos(null);
    }, []);

    // Brush/Eraser mouse handlers
    const handleBrushMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (!activeTool || (activeTool !== 'brush' && activeTool !== 'eraser') || !polygonContainerRef.current) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const imgElement = polygonContainerRef.current.querySelector('img');
        if (!imgElement) return;
        
        const imgRect = imgElement.getBoundingClientRect();
        const parentRect = polygonContainerRef.current.getBoundingClientRect();
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        
        // Allow drawing anywhere - No boundary restrictions
        const normalizedX = (mouseX - imgRect.left) / imgRect.width;
        const normalizedY = (mouseY - imgRect.top) / imgRect.height;
        // Update cursor absolute position relative to polygon container for correct overlay alignment
        setCursorPos({ x: (imgRect.left - parentRect.left) + (mouseX - imgRect.left), y: (imgRect.top - parentRect.top) + (mouseY - imgRect.top) });
        
        // Clear any accumulated points from previous stroke
        currentStrokePointsRef.current = [];
        
        setIsDrawing(true);
        setBrushStrokes(prev => [...prev, {
            type: activeTool,
            points: [{x: normalizedX, y: normalizedY}],
            size: brushSize,
            color: activeTool === 'brush' ? brushColor : undefined,
            opacity: activeTool === 'brush' ? brushOpacity : undefined
        }]);
    }, [activeTool, brushSize, brushColor, brushOpacity]);

    const rafPendingRef = useRef(false);
    const lastMouseEventRef = useRef<{ x: number; y: number } | null>(null);
    const currentStrokePointsRef = useRef<Array<{x: number, y: number}>>([]);
    
    const handleBrushMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (!polygonContainerRef.current) return;
        const imgElement = polygonContainerRef.current.querySelector('img');
        if (!imgElement) return;

        const imgRect = imgElement.getBoundingClientRect();
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        const parentRect = polygonContainerRef.current.getBoundingClientRect();
        const relX = mouseX - imgRect.left;
        const relY = mouseY - imgRect.top;

        // Update cursor overlay position immediately (lightweight)
        if (activeTool === 'brush' || activeTool === 'eraser') {
            if (relX >= 0 && relX <= imgRect.width && relY >= 0 && relY <= imgRect.height) {
                setCursorPos({ x: (imgRect.left - parentRect.left) + relX, y: (imgRect.top - parentRect.top) + relY });
            } else {
                setCursorPos(null);
            }
        }

        if (!isDrawing || !activeTool || (activeTool !== 'brush' && activeTool !== 'eraser')) return;
        
        // Allow drawing anywhere - No boundary restrictions
        const normalizedX = relX / imgRect.width;
        const normalizedY = relY / imgRect.height;

        // Accumulate points in ref (no re-render)
        currentStrokePointsRef.current.push({ x: normalizedX, y: normalizedY });

        // Batch update to state using RAF (reduces lag significantly)
        if (rafPendingRef.current) return;
        rafPendingRef.current = true;
        requestAnimationFrame(() => {
            rafPendingRef.current = false;
            if (currentStrokePointsRef.current.length === 0) return;
            
            const pointsToAdd = [...currentStrokePointsRef.current];
            currentStrokePointsRef.current = [];
            
            setBrushStrokes(prev => {
                const updated = [...prev];
                const lastStroke = updated[updated.length - 1];
                if (lastStroke) {
                    lastStroke.points.push(...pointsToAdd);
                }
                return updated;
            });
        });
    }, [isDrawing, activeTool]);

    const handleBrushMouseUp = useCallback(() => {
        setIsDrawing(false);
        currentStrokePointsRef.current = []; // Clear accumulated points
        // Don't auto-apply - brush strokes are shown as canvas overlay preview
        // User must click "Apply" button (same as pen tool workflow)
    }, []);

    // Helper: Constrain angle to 45° increments if Shift is pressed
    const constrainAngle = useCallback((dx: number, dy: number): {dx: number, dy: number} => {
        if (!isShiftPressed) return {dx, dy};
        
        const angle = Math.atan2(dy, dx);
        const deg = angle * 180 / Math.PI;
        
        // Snap to nearest 45° angle
        const snappedDeg = Math.round(deg / 45) * 45;
        const snappedRad = snappedDeg * Math.PI / 180;
        const magnitude = Math.sqrt(dx * dx + dy * dy);
        
        return {
            dx: Math.cos(snappedRad) * magnitude,
            dy: Math.sin(snappedRad) * magnitude
        };
    }, [isShiftPressed]);

    // Mouse down handler for pen tool
    const handlePenMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (!isPenErasing || !polygonContainerRef.current) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const imgElement = polygonContainerRef.current.querySelector('img');
        if (!imgElement) return;
        
        const imgRect = imgElement.getBoundingClientRect();
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        
        // Check bounds
        if (mouseX < imgRect.left || mouseX > imgRect.right || 
            mouseY < imgRect.top || mouseY > imgRect.bottom) {
            return;
        }
        
        const normalizedX = (mouseX - imgRect.left) / imgRect.width;
        const normalizedY = (mouseY - imgRect.top) / imgRect.height;
        const clampedX = Math.max(0, Math.min(1, normalizedX));
        const clampedY = Math.max(0, Math.min(1, normalizedY));
        
        // Check if clicking near first point to close path
        if (penPoints.length >= 3 && isNearFirstPoint) {
            applyPenEraser();
            return;
        }
        
        // Check if clicking on existing anchor point (Ctrl/Cmd for direct selection)
        if (isCtrlPressed && hoveredPointIndex !== null) {
            setIsDraggingAnchor({pointIndex: hoveredPointIndex});
            setDragStartPos({x: mouseX, y: mouseY});
            return;
        }
        
        // Check if clicking on control handle (Ctrl/Cmd + Alt for handle dragging)
        if (isCtrlPressed && hoveredHandleInfo) {
            setIsDraggingHandle(true);
            setDragStartPos({x: mouseX, y: mouseY});
            return;
        }
        
        // Alt + Click on existing smooth point: convert to corner (remove handles)
        if (isAltPressed && hoveredPointIndex !== null) {
            setPenPoints(prev => prev.map((p, i) => 
                i === hoveredPointIndex 
                    ? { x: p.x, y: p.y, type: 'corner' as const }
                    : p
            ));
            return;
        }
        
        // Alt + Click on corner point: start dragging to create new handle
        if (isAltPressed && hoveredPointIndex !== null) {
            const point = penPoints[hoveredPointIndex];
            if (point.type === 'corner' && !point.cp1 && !point.cp2) {
                setIsDraggingHandle(true);
                setDragStartPos({x: mouseX, y: mouseY});
                return;
            }
        }
        
        // Regular click: Add new anchor point and start dragging to create handles
        setIsDrawingHandle(true);
        setDragStartPos({x: mouseX, y: mouseY});
        
        // Add point with pending handle
        setPenPoints(prev => [...prev, { 
            x: clampedX, 
            y: clampedY, 
            type: 'smooth' as const 
        }]);
        
    }, [isPenErasing, penPoints, isNearFirstPoint, isAltPressed, isCtrlPressed, hoveredPointIndex, hoveredHandleInfo, applyPenEraser]);

    // Mouse move handler for pen tool
    const handlePenMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (!isPenErasing || !polygonContainerRef.current) return;
        
        const imgElement = polygonContainerRef.current.querySelector('img');
        if (!imgElement) return;
        
        const imgRect = imgElement.getBoundingClientRect();
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        
        // Check if mouse is within image bounds
        if (mouseX < imgRect.left || mouseX > imgRect.right || 
            mouseY < imgRect.top || mouseY > imgRect.bottom) {
            setCurrentMousePos(null);
            setHoveredPointIndex(null);
            setHoveredHandleInfo(null);
            setIsNearFirstPoint(false);
            return;
        }
        
        const relX = mouseX - imgRect.left;
        const relY = mouseY - imgRect.top;
        setCurrentMousePos({ x: relX, y: relY });
        
        const normalizedX = relX / imgRect.width;
        const normalizedY = relY / imgRect.height;
        
        // Handle dragging anchor point (Ctrl/Cmd + drag)
        if (isDraggingAnchor && dragStartPos) {
            const dx = (mouseX - dragStartPos.x) / imgRect.width;
            const dy = (mouseY - dragStartPos.y) / imgRect.height;
            
            setPenPoints(prev => prev.map((p, i) => 
                i === isDraggingAnchor.pointIndex
                    ? {
                        ...p,
                        x: Math.max(0, Math.min(1, p.x + dx)),
                        y: Math.max(0, Math.min(1, p.y + dy))
                    }
                    : p
            ));
            
            setDragStartPos({x: mouseX, y: mouseY});
            return;
        }
        
        // Handle dragging control handle
        if (isDraggingHandle && dragStartPos && hoveredHandleInfo) {
            const pointIndex = hoveredHandleInfo.pointIndex;
            const handleType = hoveredHandleInfo.handleType;
            const point = penPoints[pointIndex];
            
            if (!point) return;
            
            const anchorX = point.x * imgRect.width;
            const anchorY = point.y * imgRect.height;
            
            let dx = relX - anchorX;
            let dy = relY - anchorY;
            
            // Apply angle constraint if Shift pressed
            if (isShiftPressed) {
                const constrained = constrainAngle(dx, dy);
                dx = constrained.dx;
                dy = constrained.dy;
            }
            
            // If not Alt-dragging, maintain symmetry (smooth point)
            if (!isAltPressed && point.type === 'smooth') {
                setPenPoints(prev => prev.map((p, i) => 
                    i === pointIndex
                        ? {
                            ...p,
                            cp1: handleType === 'cp1' 
                                ? {x: normalizedX, y: normalizedY}
                                : {x: p.x - dx / imgRect.width, y: p.y - dy / imgRect.height},
                            cp2: handleType === 'cp2'
                                ? {x: normalizedX, y: normalizedY}
                                : {x: p.x - dx / imgRect.width, y: p.y - dy / imgRect.height}
                        }
                        : p
                ));
            } else {
                // Alt-dragging: break symmetry (convert to corner or independent handles)
                setPenPoints(prev => prev.map((p, i) => 
                    i === pointIndex
                        ? {
                            ...p,
                            type: 'corner' as const,
                            [handleType]: {x: normalizedX, y: normalizedY}
                        }
                        : p
                ));
            }
            return;
        }
        
        // Handle drawing handle for newly placed point
        if (isDrawingHandle && dragStartPos) {
            const lastIndex = penPoints.length - 1;
            if (lastIndex < 0) return;
            
            const point = penPoints[lastIndex];
            const anchorX = point.x * imgRect.width;
            const anchorY = point.y * imgRect.height;
            
            let dx = relX - anchorX;
            let dy = relY - anchorY;
            
            // Spacebar: reposition anchor instead of drawing handle
            if (isSpacePressed) {
                setPenPoints(prev => prev.map((p, i) => 
                    i === lastIndex
                        ? {x: normalizedX, y: normalizedY, type: p.type}
                        : p
                ));
                setTempRepositionAnchor({x: normalizedX, y: normalizedY});
                return;
            }
            
            // Apply angle constraint if Shift pressed
            if (isShiftPressed) {
                const constrained = constrainAngle(dx, dy);
                dx = constrained.dx;
                dy = constrained.dy;
            }
            
            const cp2X = point.x + dx / imgRect.width;
            const cp2Y = point.y + dy / imgRect.height;
            
            // Outgoing handle (cp2) and symmetric incoming handle (cp1)
            setPenPoints(prev => prev.map((p, i) => 
                i === lastIndex
                    ? {
                        ...p,
                        cp2: {x: cp2X, y: cp2Y},
                        cp1: {x: point.x - dx / imgRect.width, y: point.y - dy / imgRect.height}
                    }
                    : p
            ));
            return;
        }
        
        // Check if hovering over anchor points
        const hoverThreshold = 8;
        let nearPointIndex: number | null = null;
        
        for (let i = 0; i < penPoints.length; i++) {
            const point = penPoints[i];
            const pointX = point.x * imgRect.width;
            const pointY = point.y * imgRect.height;
            const distance = Math.sqrt(
                Math.pow(relX - pointX, 2) + 
                Math.pow(relY - pointY, 2)
            );
            
            if (distance <= hoverThreshold) {
                nearPointIndex = i;
                break;
            }
        }
        
        setHoveredPointIndex(nearPointIndex);
        
        // Check if near first point (to show close path cursor)
        if (penPoints.length >= 3 && nearPointIndex === 0) {
            setIsNearFirstPoint(true);
        } else {
            setIsNearFirstPoint(false);
        }
        
        // Check if hovering over control handles
        let nearHandle: {pointIndex: number, handleType: 'cp1' | 'cp2'} | null = null;
        
        for (let i = 0; i < penPoints.length; i++) {
            const point = penPoints[i];
            
            if (point.cp1) {
                const cp1X = point.cp1.x * imgRect.width;
                const cp1Y = point.cp1.y * imgRect.height;
                const distance = Math.sqrt(
                    Math.pow(relX - cp1X, 2) + 
                    Math.pow(relY - cp1Y, 2)
                );
                if (distance <= hoverThreshold) {
                    nearHandle = {pointIndex: i, handleType: 'cp1'};
                    break;
                }
            }
            
            if (point.cp2) {
                const cp2X = point.cp2.x * imgRect.width;
                const cp2Y = point.cp2.y * imgRect.height;
                const distance = Math.sqrt(
                    Math.pow(relX - cp2X, 2) + 
                    Math.pow(relY - cp2Y, 2)
                );
                if (distance <= hoverThreshold) {
                    nearHandle = {pointIndex: i, handleType: 'cp2'};
                    break;
                }
            }
        }
        
        setHoveredHandleInfo(nearHandle);
        
    }, [isPenErasing, penPoints, isDraggingAnchor, isDraggingHandle, isDrawingHandle, 
        dragStartPos, hoveredHandleInfo, isAltPressed, isShiftPressed, isSpacePressed, 
        constrainAngle]);

    // Mouse up handler for pen tool
    const handlePenMouseUp = useCallback(() => {
        setIsDraggingAnchor(null);
        setIsDraggingHandle(false);
        setIsDrawingHandle(false);
        setDragStartPos(null);
        setTempRepositionAnchor(null);
    }, []);

    // Chroma Key Picker & Pen Eraser - Click on image
    const handleImageClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        const sourceImage = finalImage || upscaledImage;
        if (!sourceImage) return;
        
        const target = event.currentTarget;
        
        // Handle Pen Eraser Tool - use new mouse handlers
        if (isPenErasing) {
            return; // Handled by mouse down/move/up
        }
        
        // Handle Chroma Key Picker
        if (!isPickingChroma) return;
        
        const rect = target.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Create temporary canvas to sample pixel
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            ctx.drawImage(img, 0, 0);
            
            // Calculate actual image coordinates accounting for zoom/pan
            const imgRect = target.querySelector('img')?.getBoundingClientRect();
            if (!imgRect) return;
            
            const imgX = ((x - (imgRect.left - rect.left)) / imgRect.width) * img.naturalWidth;
            const imgY = ((y - (imgRect.top - rect.top)) / imgRect.height) * img.naturalHeight;
            
            // Sample 5x5 area and average for more stable color
            let r = 0, g = 0, b = 0, count = 0;
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                    const px = Math.max(0, Math.min(img.naturalWidth - 1, Math.round(imgX + dx)));
                    const py = Math.max(0, Math.min(img.naturalHeight - 1, Math.round(imgY + dy)));
                    try {
                        const data = ctx.getImageData(px, py, 1, 1).data;
                        r += data[0];
                        g += data[1];
                        b += data[2];
                        count++;
                    } catch (e) {
                        console.warn('Failed to sample pixel', e);
                    }
                }
            }
            
            if (count > 0) {
                const picked = {
                    r: Math.round(r / count),
                    g: Math.round(g / count),
                    b: Math.round(b / count)
                };
                setPickedChroma(picked);
                setCustomChroma(picked);
                setChromaMode('custom');
                setIsPickingChroma(false);
                
                // Show toast notification
                setToast(`Picked: RGB(${picked.r}, ${picked.g}, ${picked.b})`);
                setTimeout(() => setToast(null), 3000);
            }
        };
        img.onerror = () => {
            console.error('Failed to load image for color picking');
            setIsPickingChroma(false);
        };
        img.src = sourceImage as string;
    }, [isPickingChroma, upscaledImage, finalImage, isPenErasing]);

    // Keyboard event listeners for pen tool modifiers and actions
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Modifier keys for pen tool
            if (e.key === 'Alt') setIsAltPressed(true);
            if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(true);
            if (e.key === 'Shift') setIsShiftPressed(true);
            if (e.key === ' ') {
                e.preventDefault();
                setIsSpacePressed(true);
            }
            
            // Action keys
            if (e.key === 'Escape') {
                if (isPenErasing) {
                    // ESC ends path without closing
                    if (penPoints.length >= 3) {
                        // Path is valid, trigger apply
                        applyPenEraser();
                    } else {
                        cancelPenEraser();
                    }
                } else if (isPickingChroma) {
                    setIsPickingChroma(false);
                }
            }
            
            if (isPenErasing) {
                // Backspace/Delete removes last point
                if (e.key === 'Backspace' || e.key === 'Delete') {
                    e.preventDefault();
                    setPenPoints(prev => {
                        if (prev.length === 0) return prev;
                        return prev.slice(0, -1);
                    });
                }
                
                // Enter closes and applies path
                if (e.key === 'Enter' && penPoints.length >= 3) {
                    e.preventDefault();
                    applyPenEraser();
                }
            }
        };
        
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Alt') setIsAltPressed(false);
            if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(false);
            if (e.key === 'Shift') setIsShiftPressed(false);
            if (e.key === ' ') setIsSpacePressed(false);
        };
        
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isPenErasing, isPickingChroma, penPoints.length, cancelPenEraser, applyPenEraser]);

    const reset = () => {
        setStep('upload');
        setOriginalImage(null);
        setClonedImage(null);
        setUpscaledImage(null);
        setFinalImage(null);
        setPreviewImage(null);
        setPenPoints([]);
        setIsPenErasing(false);
        setTuningDirty(false);
        setIsReprocessing(false);
        setBrushStrokes([]);
        setActiveTool(null);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (previewAbortController.current) {
                previewAbortController.current.abort();
            }
            if (processingTimeoutRef.current) {
                clearTimeout(processingTimeoutRef.current);
            }
        };
    }, []);

    // Listen to toolbar events in clone mode
    useEffect(() => {
        const handleSetTool = (e: Event) => {
            const custom = e as CustomEvent<{ tool: import('../types').Tool }>;
            const tool = custom.detail.tool;
            if (tool === 'brush') setActiveTool('brush');
            else if (tool === 'eraser') setActiveTool('eraser');
            else setActiveTool(null);
            if (tool !== 'send') setIsPenErasing(false);
        };
        const handleTogglePen = () => {
            setIsPenErasing(prev => !prev);
            if (!isPenErasing) setActiveTool(null);
        };
        const handleFileSelected = (e: Event) => {
            const custom = e as CustomEvent<{ dataUrl: string }>;
            setPendingFile(custom.detail.dataUrl);
            setShowModelSelection(true);
        };
        window.addEventListener('clone:set-tool', handleSetTool as any);
        window.addEventListener('clone:toggle-pen', handleTogglePen);
        window.addEventListener('clone:file-selected', handleFileSelected as any);
        return () => {
            window.removeEventListener('clone:set-tool', handleSetTool as any);
            window.removeEventListener('clone:toggle-pen', handleTogglePen);
            window.removeEventListener('clone:file-selected', handleFileSelected as any);
        };
    }, [isPenErasing]);

    const [jobId, setJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<string | null>(null);
    const [jobResultUrl, setJobResultUrl] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const applyFinal = async () => {
        setIsReprocessing(true);
        
        try {
            let imageToDownload: string;
            
            // ✅ CRITICAL FIX: Auto-apply pending tool edits before download
            if (penPoints.length > 0 || brushStrokes.length > 0) {
                console.log('🔧 Auto-applying pending edits before download...');
                
                // Get base image
                const sourceImage = previewImage || finalImage || upscaledImage;
                if (!sourceImage) {
                    throw new Error('No image to process');
                }
                
                // Create canvas with edits
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = sourceImage;
                });
                
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('Could not get canvas context');
                
                ctx.drawImage(img, 0, 0);
                
                // Apply pen path transparency
                if (penPoints.length > 0) {
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.fillStyle = 'black';
                    ctx.beginPath();
                    
                    penPoints.forEach((point, i) => {
                        const x = point.x * canvas.width;
                        const y = point.y * canvas.height;
                        if (i === 0) ctx.moveTo(x, y);
                        else {
                            const prevPoint = penPoints[i - 1];
                            if (prevPoint.cp2 && point.cp1) {
                                ctx.bezierCurveTo(
                                    prevPoint.cp2.x * canvas.width,
                                    prevPoint.cp2.y * canvas.height,
                                    point.cp1.x * canvas.width,
                                    point.cp1.y * canvas.height,
                                    x, y
                                );
                            } else {
                                ctx.lineTo(x, y);
                            }
                        }
                    });
                    ctx.closePath();
                    ctx.fill();
                }
                
                // Apply brush strokes
                if (brushStrokes.length > 0) {
                    brushStrokes.forEach(stroke => {
                        ctx.globalCompositeOperation = stroke.type === 'eraser' ? 'destination-out' : 'source-over';
                        ctx.strokeStyle = stroke.color || 'black';
                        ctx.globalAlpha = stroke.opacity || 1;
                        ctx.lineWidth = stroke.size;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        
                        ctx.beginPath();
                        stroke.points.forEach((p, i) => {
                            const px = p.x * canvas.width;
                            const py = p.y * canvas.height;
                            if (i === 0) ctx.moveTo(px, py);
                            else ctx.lineTo(px, py);
                        });
                        ctx.stroke();
                    });
                }
                
                imageToDownload = canvas.toDataURL('image/png');
                
                // Update finalImage with edits
                setFinalImage(imageToDownload);
                setPreviewImage(null);
                
                // Clear edits after applying
                setPenPoints([]);
                setBrushStrokes([]);
                setIsPenErasing(false);
                setActiveTool(null);
                
                console.log('✅ Edits auto-applied successfully');
            } else {
                // No pending edits, use current image
                imageToDownload = previewImage || finalImage || upscaledImage || '';
            }
            
            if (!imageToDownload) {
                throw new Error('No image to download');
            }
            
            // Download
            const a = document.createElement('a');
            a.href = imageToDownload;
            a.download = `cutout_highres_${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            setToast('✅ High-res cutout downloaded!');
            setTuningDirty(false);
        } catch (e) {
            console.error('Download failed', e);
            setToast('❌ Download failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
            setTimeout(() => setToast(null), 4000);
        } finally {
            setIsReprocessing(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-zinc-800 text-white" onPaste={handlePaste}>
            {/* Model Selection Modal */}
            {showModelSelection && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-zinc-900 rounded-xl shadow-2xl border border-zinc-700 p-6 max-w-md w-full mx-4">
                        <h2 className="text-2xl font-bold mb-4 text-blue-400">Select Processing Models</h2>
                        
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">
                                    🧠 Pattern Extraction Model
                                </label>
                                <select 
                                    value={selectedPatternModel}
                                    onChange={(e) => setSelectedPatternModel(e.target.value as 'gemini' | 'openai')}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                >
                                    <option value="gemini">Gemini (Google)</option>
                                    <option value="openai">OpenAI</option>
                                </select>
                                <p className="text-xs text-zinc-400 mt-1">
                                    Used to generate the clean pattern from your design.
                                </p>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">
                                    📈 Upscale Model
                                </label>
                                <select 
                                    value={selectedUpscaleModel} 
                                    onChange={(e) => setSelectedUpscaleModel(e.target.value)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                >
                                    <option value="realesrgan-x4plus">Real-ESRGAN 4x (Best Quality)</option>
                                    <option value="realesrgan-x2plus">Real-ESRGAN 2x (Fast)</option>
                                    <option value="realesrnet-x4plus">Real-ESRNet 4x (Sharp)</option>
                                </select>
                                <p className="text-xs text-zinc-400 mt-1">
                                    4x recommended for maximum detail
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">
                                    🎨 Chroma Background
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={promptChromaHex}
                                        onChange={(e) => setPromptChromaHex(e.target.value)}
                                        className="w-12 h-8 rounded border border-zinc-700 bg-transparent cursor-pointer"
                                        title="Select the solid background color to separate pattern"
                                    />
                                    <input
                                        type="text"
                                        value={promptChromaHex}
                                        onChange={(e) => setPromptChromaHex(e.target.value)}
                                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-2 text-sm"
                                        placeholder="#FF00FF"
                                    />
                                </div>
                                <p className="text-xs text-zinc-400 mt-1">
                                    This color will be injected into the AI prompt for clean separation.
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowModelSelection(false);
                                    setPendingFile(null);
                                }}
                                className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={startProcessing}
                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
                            >
                                Start Clone
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {step === 'upload' && (
                <div className="w-full flex-1 flex items-center justify-center p-8">
                    <div {...getRootProps()} className={`w-full max-w-2xl h-64 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-700 hover:border-zinc-500'}`}>
                        <input {...getInputProps()} />
                        <UploadCloud className="w-12 h-12 text-zinc-500 mb-4" />
                        <p className="text-lg font-semibold">Drop your t-shirt design here</p>
                        <p className="text-sm text-zinc-400">or click to browse, or paste from clipboard</p>
                    </div>
                </div>
            )}

            {step !== 'upload' && (
                <div className="flex-1 flex relative overflow-hidden">
                    {/* Left Toolbar */}
                    {step === 'done' && (
                        <div className="absolute top-1/2 left-4 -translate-y-1/2 z-40">
                            <div className="bg-zinc-800/90 backdrop-blur-sm border border-zinc-700 rounded-xl p-1.5 flex flex-col items-center space-y-1 shadow-2xl">
                                {/* Pen Tool */}
                                <button
                                    onClick={() => setIsPenErasing(!isPenErasing)}
                                    className={`relative group p-2.5 rounded-lg transition-colors ${
                                        isPenErasing ? 'bg-white text-black' : 'hover:bg-zinc-700'
                                    }`}
                                    aria-label="Pen Tool (P)"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M 8 0 L 6 4 L 10 4 Z"/>
                                        <path d="M 8 4 L 8 12" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                                        <circle cx="8" cy="12" r="2"/>
                                    </svg>
                                    <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-zinc-900 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                                        Pen Tool (P)
                                    </span>
                                </button>

                                {/* Brush Tool */}
                                <button
                                    onClick={() => setActiveTool(activeTool === 'brush' ? null : 'brush')}
                                    className={`relative group p-2.5 rounded-lg transition-colors ${
                                        activeTool === 'brush' ? 'bg-white text-black' : 'hover:bg-zinc-700'
                                    }`}
                                    aria-label="Brush Tool (B)"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M15 5l4 4"/>
                                        <path d="m13 7-7.5 7.5a1.41 1.41 0 0 0 0 2l1 1a1.41 1.41 0 0 0 2 0L16 10"/>
                                    </svg>
                                    <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-zinc-900 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                                        Brush Tool (B)
                                    </span>
                                </button>

                                {/* Eraser Tool */}
                                <button
                                    onClick={() => setActiveTool(activeTool === 'eraser' ? null : 'eraser')}
                                    className={`relative group p-2.5 rounded-lg transition-colors ${
                                        activeTool === 'eraser' ? 'bg-white text-black' : 'hover:bg-zinc-700'
                                    }`}
                                    aria-label="Eraser Tool (E)"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/>
                                    </svg>
                                    <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-zinc-900 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                                        Eraser Tool (E)
                                    </span>
                                </button>

                                <div className="w-10/12 h-px bg-zinc-700 my-0.5"></div>

                                {/* Undo */}
                                <div className="relative group">
                                    <button 
                                        onClick={undo} 
                                        disabled={undoHistory.length === 0} 
                                        className="p-2.5 rounded-lg hover:bg-zinc-700 text-white disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors"
                                        aria-label="Undo"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                        </svg>
                                    </button>
                                    <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-zinc-900 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                                        Undo (Ctrl+Z)
                                    </span>
                                </div>

                                {/* Redo */}
                                <div className="relative group">
                                    <button 
                                        onClick={redo} 
                                        disabled={redoHistory.length === 0} 
                                        className="p-2.5 rounded-lg hover:bg-zinc-700 text-white disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors"
                                        aria-label="Redo"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                                        </svg>
                                    </button>
                                    <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-zinc-900 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                                        Redo (Ctrl+Shift+Z)
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Image Panel: Takes up remaining space and handles its own overflow */}
                    <div className={`flex-1 flex items-center justify-center p-4 bg-zinc-900 relative ${isPenErasing || activeTool ? 'overflow-hidden' : 'overflow-auto'}`}>
                        {(step === 'cloning' || step === 'detecting' || step === 'upscaling' || step === 'resizing') && (
                            <div className="flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 border-4 border-zinc-700 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                                <p className="text-lg font-semibold capitalize tracking-wider">
                                    {step === 'detecting' ? '🔍 Detecting Pattern' : 
                                     step === 'resizing' ? '✨ Processing Full Resolution' :
                                     `${step}...`}
                                </p>
                                <p className="text-sm text-zinc-400">
                                    {step === 'detecting' 
                                        ? 'Finding and cropping design boundaries...'
                                        : step === 'resizing'
                                        ? 'Applying chroma removal at full quality (no preview mode)...'
                                        : 'This may take a minute.'
                                    }
                                </p>
                            </div>
                        )}
                        {step === 'done' && (
                            <div 
                                className={`relative w-full h-full flex items-center justify-center ${
                                    isPenErasing 
                                        ? isNearFirstPoint 
                                            ? 'pentool-cursor-close' 
                                            : 'pentool-cursor'
                                        : ''
                                }`}
                                style={{
                                    ...panelBgStyle,
                                    cursor: isPickingChroma 
                                        ? getCursorStyle('eyedropper')
                                        : isPenErasing
                                        ? (isNearFirstPoint ? 'pointer' : getCursorStyle('penTool'))
                                        : activeTool === 'brush'
                                        ? 'crosshair'
                                        : activeTool === 'eraser'
                                        ? 'cell'
                                        : 'default'
                                }}
                                onClick={handleImageClick}
                                onMouseDown={(isPenErasing || activeTool === 'brush' || activeTool === 'eraser') 
                                    ? (activeTool === 'brush' || activeTool === 'eraser' ? handleBrushMouseDown : handlePenMouseDown)
                                    : undefined}
                                onMouseMove={(isPenErasing || activeTool === 'brush' || activeTool === 'eraser')
                                    ? (activeTool === 'brush' || activeTool === 'eraser' ? handleBrushMouseMove : handlePenMouseMove)
                                    : handleMouseMove}
                                onMouseUp={(isPenErasing || activeTool === 'brush' || activeTool === 'eraser')
                                    ? (activeTool === 'brush' || activeTool === 'eraser' ? handleBrushMouseUp : handlePenMouseUp)
                                    : undefined}
                            >
                                <div ref={polygonContainerRef} style={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden'}}>
                                    <ZoomableImage 
                                        ref={zoomableImageRef} 
                                        src={(previewImage || finalImage || upscaledImage || '')}
                                        className="w-full h-full"
                                        preserveZoomOnSrcUpdate={true}
                                        disablePan={isPenErasing || isPickingChroma || activeTool === 'brush' || activeTool === 'eraser'}
                                    />
                                    
                                    {/* Pen Eraser Polygon Overlay - Canvas for precise coordinate mapping */}
                                    {isPenErasing && (
                                        <canvas
                                            className="polygon-overlay absolute pointer-events-none"
                                            style={{
                                                zIndex: 35
                                            }}
                                        />
                                    )}
                                    
                                    {/* Brush/Eraser Cursor Preview Circle */}
                                    {(activeTool === 'brush' || activeTool === 'eraser') && cursorPos && (
                                        <div 
                                            className="absolute pointer-events-none"
                                            style={{
                                                left: cursorPos.x,
                                                top: cursorPos.y,
                                                transform: 'translate(-50%, -50%)',
                                                zIndex: 36,
                                                width: brushSize,
                                                height: brushSize,
                                                borderRadius: '50%',
                                                border: activeTool === 'eraser' ? '2px solid rgba(255,0,0,0.9)' : '2px solid rgba(0,0,0,0.9)',
                                                backgroundColor: activeTool === 'eraser' ? 'rgba(255,0,0,0.15)' : `${brushColor}${Math.round(brushOpacity * 0.25 * 255).toString(16).padStart(2, '0')}`
                                            }}
                                        />
                                    )}
                                </div>

                                {/* Chroma Key Picker Overlay */}
                                {isPickingChroma && (
                                    <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
                                        <div className="bg-blue-600/90 text-white px-4 py-2 rounded-lg shadow-lg">
                                            <p className="text-sm font-semibold">🎨 Click on the background color to pick</p>
                                            <p className="text-xs text-blue-100 mt-1">Press ESC to cancel</p>
                                        </div>
                                    </div>
                                )}

                                {/* Brush/Eraser Instructions & Controls */}
                                {(activeTool === 'brush' || activeTool === 'eraser') && (
                                    <>
                                        <div className="absolute inset-x-0 top-4 z-40 flex flex-col items-center gap-3 pointer-events-none">
                                            <div className={`${activeTool === 'brush' ? 'bg-gradient-to-r from-purple-600/95 to-purple-500/95' : 'bg-gradient-to-r from-pink-600/95 to-pink-500/95'} text-white px-5 py-3 rounded-lg shadow-xl border ${activeTool === 'brush' ? 'border-purple-400/30' : 'border-pink-400/30'} backdrop-blur-sm`}>
                                                <p className="text-sm font-bold flex items-center gap-2">
                                                    {activeTool === 'brush' ? (
                                                        <>
                                                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M15 5l4 4"/>
                                                                <path d="m13 7-7.5 7.5a1.41 1.41 0 0 0 0 2l1 1a1.41 1.41 0 0 0 2 0L16 10"/>
                                                            </svg>
                                                            Brush Tool
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/>
                                                            </svg>
                                                            Eraser Tool
                                                        </>
                                                    )}
                                                </p>
                                                <p className="text-xs text-white/90 mt-2 font-medium">
                                                    Click and drag to {activeTool === 'brush' ? 'draw' : 'erase'}  • Ctrl+Z to undo
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {/* Apply/Cancel buttons for brush strokes */}
                                        {brushStrokes.length > 0 && (
                                            <div className="absolute inset-x-0 bottom-4 z-40 flex justify-center gap-3 pointer-events-auto">
                                                <button 
                                                    onClick={cancelPenEraser}
                                                    className="px-6 py-2.5 bg-zinc-800/90 hover:bg-zinc-700/90 text-white font-medium rounded-lg shadow-lg backdrop-blur-sm border border-zinc-600/50 transition-all"
                                                >
                                                    ✕ Cancel
                                                </button>
                                                <button 
                                                    onClick={applyBrushStrokes}
                                                    className="px-6 py-2.5 bg-emerald-600/90 hover:bg-emerald-500/90 text-white font-semibold rounded-lg shadow-lg backdrop-blur-sm border border-emerald-500/50 transition-all"
                                                >
                                                    ✓ Apply
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Pen Eraser Instructions & Controls */}
                                {isPenErasing && (
                                    <>
                                        <div className="absolute inset-x-0 top-4 z-40 flex flex-col items-center gap-3 pointer-events-none">
                                            <div className="bg-gradient-to-r from-blue-600/95 to-blue-500/95 text-white px-5 py-3 rounded-lg shadow-xl border border-blue-400/30 backdrop-blur-sm">
                                                <p className="text-sm font-bold flex items-center gap-2">
                                                    <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
                                                        <path d="M 8 0 L 6 4 L 10 4 Z"/>
                                                        <path d="M 8 4 L 8 12" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                                                        <circle cx="8" cy="12" r="2"/>
                                                    </svg>
                                                    Photoshop Pen Tool - Eraser Mode
                                                </p>
                                                <p className="text-xs text-blue-100 mt-2 font-medium">
                                                    {penPoints.length === 0 && 'Click to add anchor • Click & drag for smooth curves'}
                                                    {penPoints.length === 1 && '1 anchor - click to continue path'}
                                                    {penPoints.length === 2 && '2 anchors - one more to complete'}
                                                    {penPoints.length >= 3 && !isNearFirstPoint && `${penPoints.length} anchors - click first to close`}
                                                    {penPoints.length >= 3 && isNearFirstPoint && '✓ Click to close path and erase'}
                                                </p>
                                                <div className="mt-2.5 pt-2 border-t border-blue-300/30 space-y-1">
                                                    <p className="text-[10px] text-blue-50/90">
                                                        <span className="font-semibold">Alt/Option</span> = Break handle symmetry (cusp) | 
                                                        <span className="font-semibold ml-1">Ctrl/Cmd</span> = Direct select
                                                    </p>
                                                    <p className="text-[10px] text-blue-50/90">
                                                        <span className="font-semibold">Shift</span> = Constrain 45° | 
                                                        <span className="font-semibold ml-1">Space</span> = Reposition anchor
                                                    </p>
                                                    <p className="text-[10px] text-blue-50/90">
                                                        <span className="font-semibold">Backspace</span> = Delete last | 
                                                        <span className="font-semibold ml-1">Esc</span> = Cancel | 
                                                        <span className="font-semibold ml-1">Ctrl+Z</span> = Undo
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Apply/Cancel buttons for pen path */}
                                        {penPoints.length >= 3 && (
                                            <div className="absolute inset-x-0 bottom-4 z-40 flex justify-center gap-3 pointer-events-auto">
                                                <button 
                                                    onClick={cancelPenEraser}
                                                    className="px-6 py-2.5 bg-zinc-800/90 hover:bg-zinc-700/90 text-white font-medium rounded-lg shadow-lg backdrop-blur-sm border border-zinc-600/50 transition-all"
                                                >
                                                    ✕ Cancel
                                                </button>
                                                <button 
                                                    onClick={applyPenEraser}
                                                    className="px-6 py-2.5 bg-emerald-600/90 hover:bg-emerald-500/90 text-white font-semibold rounded-lg shadow-lg backdrop-blur-sm border border-emerald-500/50 transition-all"
                                                >
                                                    ✓ Apply Path
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Live-apply mode: no unsaved preview badge */}
                            </div>
                        )}
                        {isReprocessing && step === 'done' && (
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-40 pointer-events-none">
                                <div className="bg-zinc-900/90 backdrop-blur-sm rounded-lg p-3 flex items-center gap-3">
                                    <div className="w-6 h-6 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin"></div>
                                    <span className="text-sm text-zinc-300">Processing...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Control Panel: Fixed width, handles its own scrolling */}
                    <div className="w-96 bg-gradient-to-br from-blue-950/90 via-slate-900/90 to-blue-950/90 backdrop-blur-sm border-l border-blue-700/30 p-4 space-y-4 overflow-y-auto flex flex-col h-full">
                        <h2 className="text-lg font-bold text-blue-300 border-b border-blue-700/50 pb-2">🎨 Clone & Cutout</h2>
                        
                        {/* Background selector as thumbnail grid */}
                        <div className="space-y-2">
                            <span className="text-xs font-semibold text-blue-300 uppercase tracking-wide">Preview Background</span>
                            <div className="grid grid-cols-3 gap-2">
                                <button 
                                    onClick={()=>setPreviewBgMode('checker')} 
                                    className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all ${previewBgMode==='checker' ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-gray-700 hover:border-gray-600'}`}
                                    style={{
                                        backgroundImage: 'linear-gradient(45deg,#6b6b6b 25%,transparent 25%),linear-gradient(-45deg,#6b6b6b 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#6b6b6b 75%),linear-gradient(-45deg,transparent 75%,#6b6b6b 75%)',
                                        backgroundSize: '12px 12px',
                                        backgroundPosition: '0 0,0 6px,6px -6px,-6px 0'
                                    }}
                                >
                                    {previewBgMode==='checker' && <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center"><span className="text-white text-2xl">✓</span></div>}
                                </button>
                                <button 
                                    onClick={()=>setPreviewBgMode('green')} 
                                    className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all ${previewBgMode==='green' ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-gray-700 hover:border-gray-600'}`}
                                    style={{backgroundColor: '#00ff00'}}
                                >
                                    {previewBgMode==='green' && <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center"><span className="text-white text-2xl">✓</span></div>}
                                </button>
                                <button 
                                    onClick={()=>setPreviewBgMode('custom')} 
                                    className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all ${previewBgMode==='custom' ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-gray-700 hover:border-gray-600'}`}
                                    style={{backgroundColor: previewBgColor}}
                                >
                                    {previewBgMode==='custom' && <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center"><span className="text-white text-2xl">✓</span></div>}
                                </button>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-400">Opacity</span>
                                <input type="range" min={0} max={1} step={0.05} value={previewBgOpacity} onChange={e=>setPreviewBgOpacity(Number(e.target.value))} className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                <span className="text-xs text-blue-300 font-mono">{Math.round(previewBgOpacity*100)}%</span>
                            </div>
                            {previewBgMode === 'custom' && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">Color</span>
                                    <input 
                                        type="color" 
                                        value={previewBgColor} 
                                        onChange={e=>setPreviewBgColor(e.target.value)} 
                                        className="w-full h-8 rounded border border-blue-700/30 cursor-pointer"
                                    />
                                </div>
                            )}
                        </div>
                        
                        {/* Undo/Redo Controls */}
                        <div className="space-y-2">
                            <span className="text-xs font-semibold text-blue-300 uppercase tracking-wide">History</span>
                            <div className="flex items-center gap-2 bg-zinc-800 rounded-lg p-2">
                                <button
                                    onClick={undo}
                                    disabled={undoHistory.length === 0}
                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                                        undoHistory.length === 0 
                                            ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed' 
                                            : 'bg-zinc-700 hover:bg-zinc-600 text-white'
                                    }`}
                                    title="Undo (Ctrl+Z)"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                    </svg>
                                    <span className="text-sm">Undo</span>
                                    {undoHistory.length > 0 && (
                                        <span className="text-xs text-gray-400">({undoHistory.length})</span>
                                    )}
                                </button>
                                
                                <button
                                    onClick={redo}
                                    disabled={redoHistory.length === 0}
                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                                        redoHistory.length === 0 
                                            ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed' 
                                            : 'bg-zinc-700 hover:bg-zinc-600 text-white'
                                    }`}
                                    title="Redo (Ctrl+Shift+Z or Ctrl+Y)"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                                    </svg>
                                    <span className="text-sm">Redo</span>
                                    {redoHistory.length > 0 && (
                                        <span className="text-xs text-gray-400">({redoHistory.length})</span>
                                    )}
                                </button>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-blue-300 uppercase tracking-wide">Process Steps</h3>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="w-full aspect-square bg-gray-800/50 rounded-md overflow-hidden border border-blue-700/30 hover:border-blue-600/50 transition-colors">
                                    {originalImage && <img src={originalImage} alt="Original" title="Original" className="w-full h-full object-contain" />}
                                </div>
                                <div className="w-full aspect-square bg-gray-800/50 rounded-md overflow-hidden border border-blue-700/30 hover:border-blue-600/50 transition-colors">
                                    {clonedImage && <img src={clonedImage} alt="Cloned" title="Cloned & Cleaned" className="w-full h-full object-contain" />}
                                </div>
                                <div className="w-full aspect-square bg-gray-800/50 rounded-md overflow-hidden border border-blue-700/30 hover:border-blue-600/50 transition-colors">
                                    {upscaledImage && <img src={upscaledImage} alt="Upscaled" title="Upscaled" className="w-full h-full object-contain" />}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 flex-grow">
                            <h3 className="text-xs font-semibold text-blue-300 uppercase tracking-wide">Mask Tuning</h3>
                            
                            {/* Two-column layout for controls */}
                            <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                                <label className="block text-xs space-y-1.5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-blue-200 font-medium flex items-center gap-1">
                                            Tolerance
                                            <span className="text-gray-400 cursor-help" title="Color matching sensitivity - higher = more colors removed">ⓘ</span>
                                        </span>
                                        <input 
                                            type="number" 
                                            min={0} 
                                            max={150} 
                                            value={chromaTolerance} 
                                            onChange={e=>setChromaTolerance(Number(e.target.value))}
                                            onWheel={e=>{ e.stopPropagation(); setChromaTolerance(Math.max(0, Math.min(150, chromaTolerance + (e.deltaY < 0 ? 1 : -1)))); }}
                                            onFocus={e=>e.currentTarget.addEventListener('wheel', (ev) => ev.preventDefault(), {passive: false})}
                                            onBlur={e=>e.currentTarget.removeEventListener('wheel', (ev) => ev.preventDefault())}
                                            className="w-16 px-1.5 py-0.5 bg-blue-700/50 text-blue-100 text-xs rounded font-mono text-center border-0 focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    <input type="range" min={0} max={150} value={chromaTolerance} onChange={e=>setChromaTolerance(Number(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                </label>
                                <label className="block text-xs space-y-1.5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-blue-200 font-medium flex items-center gap-1">
                                            Feather
                                            <span className="text-gray-400 cursor-help" title="Edge softness - creates smooth fade at edges">ⓘ</span>
                                        </span>
                                        <input 
                                            type="number" 
                                            min={0} 
                                            max={64} 
                                            value={featherRadius} 
                                            onChange={e=>setFeatherRadius(Number(e.target.value))}
                                            onWheel={e=>{ e.stopPropagation(); setFeatherRadius(Math.max(0, Math.min(64, featherRadius + (e.deltaY < 0 ? 1 : -1)))); }}
                                            onFocus={e=>e.currentTarget.addEventListener('wheel', (ev) => ev.preventDefault(), {passive: false})}
                                            onBlur={e=>e.currentTarget.removeEventListener('wheel', (ev) => ev.preventDefault())}
                                            className="w-16 px-1.5 py-0.5 bg-blue-700/50 text-blue-100 text-xs rounded font-mono text-center border-0 focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    <input type="range" min={0} max={64} value={featherRadius} onChange={e=>setFeatherRadius(Number(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                </label>
                                <div className="text-xs space-y-1.5">
                                    <span className="text-blue-200 font-medium flex items-center gap-1">
                                        Morph
                                        <span className="text-gray-400 cursor-help" title="Dilate expands edges, Erode shrinks edges">ⓘ</span>
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <select value={morphOp} onChange={e=>setMorphOp(e.target.value as any)} className="flex-1 bg-gray-800/50 rounded-md px-2 py-1.5 text-xs border border-blue-700/30 focus:ring-2 focus:ring-blue-500 focus:outline-none text-blue-100">
                                            <option value="dilate">Dilate</option>
                                            <option value="erode">Erode</option>
                                        </select>
                                        <input type="number" min={0} max={10} value={morphIter} onChange={e=>setMorphIter(Number(e.target.value))} className="w-14 bg-gray-800/50 rounded-md px-2 py-1.5 text-xs border border-blue-700/30 focus:ring-2 focus:ring-blue-500 focus:outline-none text-blue-100 text-center font-mono" />
                                    </div>
                                </div>
                            </div>

                            {/* Chroma picker - single row */}
                            <div className="space-y-2 pt-2">
                                <div className="flex items-center gap-2">
                                    <select value={chromaMode} onChange={e=>setChromaMode(e.target.value as any)} className="flex-1 bg-gray-800/50 rounded-md px-3 py-2 text-xs border border-blue-700/30 focus:ring-2 focus:ring-blue-500 focus:outline-none text-blue-100">
                                        <option value="auto">Auto-Detect</option>
                                        <option value="magenta">Magenta</option>
                                        <option value="green">Green</option>
                                        <option value="custom">Custom</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsPickingChroma(!isPickingChroma);
                                        }}
                                        className={`w-9 h-9 flex items-center justify-center rounded-md font-medium transition-all ${
                                            isPickingChroma 
                                                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50' 
                                                : 'bg-blue-700/50 text-blue-100 hover:bg-blue-600/50 border border-blue-600/50'
                                        }`}
                                        title="Eyedropper - Pick color from image"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M2.5 16.88a1 1 0 0 1-.32-1.43l9-13.02a1 1 0 0 1 1.64 0l9 13.01a1 1 0 0 1-.32 1.44l-8.51 4.86a2 2 0 0 1-1.98 0z"/>
                                            <path d="M12 16v6"/>
                                        </svg>
                                    </button>
                                </div>
                                
                                {/* Brush/Eraser settings */}
                                {(activeTool === 'brush' || activeTool === 'eraser') && (
                                    <div className="space-y-2 p-2 bg-blue-900/20 rounded-md border border-blue-700/30">
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-blue-200 font-medium min-w-[45px]">Size:</label>
                                            <input
                                                type="range"
                                                min="5"
                                                max="100"
                                                value={brushSize}
                                                onChange={(e) => setBrushSize(Number(e.target.value))}
                                                className="flex-1 h-1.5 bg-blue-700/30 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
                                            />
                                            <span className="text-xs text-blue-100 font-mono min-w-[30px] text-right">{brushSize}</span>
                                        </div>
                                        
                                        {activeTool === 'brush' && (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-xs text-blue-200 font-medium min-w-[45px]">Color:</label>
                                                    <input
                                                        type="color"
                                                        value={brushColor}
                                                        onChange={(e) => setBrushColor(e.target.value)}
                                                        className="w-8 h-6 rounded border border-blue-600/50 cursor-pointer bg-transparent"
                                                    />
                                                    <span className="text-xs text-blue-100 font-mono">{brushColor}</span>
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    <label className="text-xs text-blue-200 font-medium min-w-[45px]">Opacity:</label>
                                                    <input
                                                        type="range"
                                                        min="0.1"
                                                        max="1"
                                                        step="0.1"
                                                        value={brushOpacity}
                                                        onChange={(e) => setBrushOpacity(Number(e.target.value))}
                                                        className="flex-1 h-1.5 bg-blue-700/30 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
                                                    />
                                                    <span className="text-xs text-blue-100 font-mono min-w-[30px] text-right">{Math.round(brushOpacity * 100)}%</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                                
                                {chromaMode === 'custom' && pickedChroma && (
                                    <div className="flex items-center gap-2 p-2 bg-blue-900/30 rounded-md border border-blue-700/50">
                                        <div 
                                            className="w-5 h-5 rounded border border-blue-600/50"
                                            style={{backgroundColor: `rgb(${pickedChroma.r}, ${pickedChroma.g}, ${pickedChroma.b})`}}
                                        />
                                        <span className="text-xs text-blue-200 font-mono">
                                            RGB({pickedChroma.r}, {pickedChroma.g}, {pickedChroma.b})
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Output format */}
                            <label className="block text-xs space-y-1.5">
                                <span className="text-blue-200 font-medium">Output Format</span>
                                <select value={outputFormat} onChange={e=>setOutputFormat(e.target.value as any)} className="w-full bg-gray-800/50 rounded-md px-3 py-2 text-xs border border-blue-700/30 focus:ring-2 focus:ring-blue-500 focus:outline-none text-blue-100">
                                    <option value="png">📄 PNG (sRGB)</option>
                                    <option value="tiff-cmyk">🖨️ TIFF (CMYK)</option>
                                </select>
                            </label>

                            {/* Advanced Edge Processing Section - Collapsible */}
                            <div className="mt-3 pt-3 border-t border-blue-700/30">
                                <button 
                                    onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                                    className="w-full flex items-center justify-between text-left text-xs font-semibold text-blue-300 uppercase tracking-wide hover:text-blue-200 transition-colors"
                                >
                                    <span>⚙️ Advanced Edge Controls</span>
                                    <span className="text-base">{isAdvancedOpen ? '▼' : '▶'}</span>
                                </button>
                                
                                {isAdvancedOpen && <div className="space-y-3 mt-3">
                                    {/* Toggle switches row - compact */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className="flex items-center space-x-1.5 p-1.5 bg-gray-800/30 rounded-md hover:bg-gray-800/50 transition-colors cursor-pointer">
                                            <input type="checkbox" checked={edgeEnhancement} onChange={e=>setEdgeEnhancement(e.target.checked)} className="w-3.5 h-3.5 text-blue-500 rounded focus:ring-blue-500" />
                                            <span className="text-xs text-blue-200">Edge Enhance</span>
                                        </label>
                                        <label className="flex items-center space-x-1.5 p-1.5 bg-gray-800/30 rounded-md hover:bg-gray-800/50 transition-colors cursor-pointer">
                                            <input type="checkbox" checked={antiAliasing} onChange={e=>setAntiAliasing(e.target.checked)} className="w-3.5 h-3.5 text-blue-500 rounded focus:ring-blue-500" />
                                            <span className="text-xs text-blue-200">Anti-alias</span>
                                        </label>
                                        <label className="flex items-center space-x-1.5 p-1.5 bg-gray-800/30 rounded-md hover:bg-gray-800/50 transition-colors cursor-pointer">
                                            <input type="checkbox" checked={colorBleedPrevention} onChange={e=>setColorBleedPrevention(e.target.checked)} className="w-3.5 h-3.5 text-blue-500 rounded focus:ring-blue-500" />
                                            <span className="text-xs text-blue-200">Color Bleed</span>
                                        </label>
                                        <label className="flex items-center space-x-1.5 p-1.5 bg-gray-800/30 rounded-md hover:bg-gray-800/50 transition-colors cursor-pointer">
                                            <input type="checkbox" checked={adaptiveFeathering} onChange={e=>setAdaptiveFeathering(e.target.checked)} className="w-3.5 h-3.5 text-blue-500 rounded focus:ring-blue-500" />
                                            <span className="text-xs text-blue-200">Smart Feather</span>
                                        </label>
                                        <label className="flex items-center space-x-1.5 p-1.5 bg-emerald-900/30 rounded-md border border-emerald-700/30 hover:bg-emerald-900/50 transition-colors cursor-pointer col-span-2">
                                            <input type="checkbox" checked={protectBlacks} onChange={e=>setProtectBlacks(e.target.checked)} className="w-3.5 h-3.5 text-emerald-500 rounded focus:ring-emerald-500" />
                                            <span className="text-xs text-emerald-200 font-medium">🛡️ Protect Black Colors</span>
                                        </label>
                                        <label className="flex items-center space-x-1.5 p-1.5 bg-gray-800/30 rounded-md hover:bg-gray-800/50 transition-colors cursor-pointer">
                                            <input type="checkbox" checked={smartRadius} onChange={e=>setSmartRadius(e.target.checked)} className="w-3.5 h-3.5 text-blue-500 rounded focus:ring-blue-500" />
                                            <span className="text-xs text-blue-200">Smart Radius</span>
                                        </label>
                                    </div>

                                    {/* Slider controls - compact with tooltips */}
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                                        <label className="block text-xs space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-blue-200 font-medium flex items-center gap-1">
                                                    Smoothing
                                                    <span className="text-gray-400 cursor-help" title="Reduces corner jaggedness">ⓘ</span>
                                                </span>
                                                <input 
                                                    type="number" 
                                                    min={0} 
                                                    max={20} 
                                                    step={0.1}
                                                    value={edgeSmoothing.toFixed(1)} 
                                                    onChange={e=>setEdgeSmoothing(Number(e.target.value))}
                                                    onWheel={e=>{ e.stopPropagation(); setEdgeSmoothing(Math.max(0, Math.min(20, edgeSmoothing + (e.deltaY < 0 ? 0.1 : -0.1)))); }}
                                                    onFocus={e=>e.currentTarget.addEventListener('wheel', (ev) => ev.preventDefault(), {passive: false})}
                                                    onBlur={e=>e.currentTarget.removeEventListener('wheel', (ev) => ev.preventDefault())}
                                                    className="w-16 px-1.5 py-0.5 bg-blue-700/50 text-blue-100 text-xs rounded font-mono text-center border-0 focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                            <input type="range" min={0} max={20} step={0.1} value={edgeSmoothing} onChange={e=>setEdgeSmoothing(Number(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                        </label>

                                        <label className="block text-xs space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-blue-200 font-medium flex items-center gap-1">
                                                    Border
                                                    <span className="text-gray-400 cursor-help" title="Removes edge artifacts">ⓘ</span>
                                                </span>
                                                <input 
                                                    type="number" 
                                                    min={0} 
                                                    max={30} 
                                                    step={0.1}
                                                    value={borderCleanup.toFixed(1)} 
                                                    onChange={e=>setBorderCleanup(Number(e.target.value))}
                                                    onWheel={e=>{ e.stopPropagation(); setBorderCleanup(Math.max(0, Math.min(30, borderCleanup + (e.deltaY < 0 ? 0.1 : -0.1)))); }}
                                                    onFocus={e=>e.currentTarget.addEventListener('wheel', (ev) => ev.preventDefault(), {passive: false})}
                                                    onBlur={e=>e.currentTarget.removeEventListener('wheel', (ev) => ev.preventDefault())}
                                                    className="w-16 px-1.5 py-0.5 bg-blue-700/50 text-blue-100 text-xs rounded font-mono text-center border-0 focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                            <input type="range" min={0} max={30} step={0.1} value={borderCleanup} onChange={e=>setBorderCleanup(Number(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                        </label>

                                        <label className="block text-xs space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-blue-200 font-medium flex items-center gap-1">
                                                    Contrast
                                                    <span className="text-gray-400 cursor-help" title="Boosts edge contrast">ⓘ</span>
                                                </span>
                                                <input 
                                                    type="number" 
                                                    min={0} 
                                                    max={200} 
                                                    value={contrastEnhancement} 
                                                    onChange={e=>setContrastEnhancement(Number(e.target.value))}
                                                    onWheel={e=>{ e.stopPropagation(); setContrastEnhancement(Math.max(0, Math.min(200, contrastEnhancement + (e.deltaY < 0 ? 1 : -1)))); }}
                                                    onFocus={e=>e.currentTarget.addEventListener('wheel', (ev) => ev.preventDefault(), {passive: false})}
                                                    onBlur={e=>e.currentTarget.removeEventListener('wheel', (ev) => ev.preventDefault())}
                                                    className="w-16 px-1.5 py-0.5 bg-blue-700/50 text-blue-100 text-xs rounded font-mono text-center border-0 focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                            <input type="range" min={0} max={200} step={1} value={contrastEnhancement} onChange={e=>setContrastEnhancement(Number(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                        </label>

                                        <label className="block text-xs space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-blue-200 font-medium flex items-center gap-1">
                                                    Edge Radius
                                                    <span className="text-gray-400 cursor-help" title="Edge detection radius">ⓘ</span>
                                                </span>
                                                <input 
                                                    type="number" 
                                                    min={0} 
                                                    max={50} 
                                                    step={0.1}
                                                    value={edgeRadius.toFixed(1)} 
                                                    onChange={e=>setEdgeRadius(Number(e.target.value))}
                                                    onWheel={e=>{ e.stopPropagation(); setEdgeRadius(Math.max(0, Math.min(50, edgeRadius + (e.deltaY < 0 ? 0.1 : -0.1)))); }}
                                                    onFocus={e=>e.currentTarget.addEventListener('wheel', (ev) => ev.preventDefault(), {passive: false})}
                                                    onBlur={e=>e.currentTarget.removeEventListener('wheel', (ev) => ev.preventDefault())}
                                                    className="w-16 px-1.5 py-0.5 bg-blue-700/50 text-blue-100 text-xs rounded font-mono text-center border-0 focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                            <input type="range" min={0} max={50} step={0.1} value={edgeRadius} onChange={e=>setEdgeRadius(Number(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                        </label>

                                        <label className="block text-xs space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-blue-200 font-medium flex items-center gap-1">
                                                    Matte Edge
                                                    <span className="text-gray-400 cursor-help" title="Removes color fringing">ⓘ</span>
                                                </span>
                                                <input 
                                                    type="number" 
                                                    min={0} 
                                                    max={50} 
                                                    step={0.1}
                                                    value={matteEdge.toFixed(1)} 
                                                    onChange={e=>setMatteEdge(Number(e.target.value))}
                                                    onWheel={e=>{ e.stopPropagation(); setMatteEdge(Math.max(0, Math.min(50, matteEdge + (e.deltaY < 0 ? 0.1 : -0.1)))); }}
                                                    onFocus={e=>e.currentTarget.addEventListener('wheel', (ev) => ev.preventDefault(), {passive: false})}
                                                    onBlur={e=>e.currentTarget.removeEventListener('wheel', (ev) => ev.preventDefault())}
                                                    className="w-16 px-1.5 py-0.5 bg-blue-700/50 text-blue-100 text-xs rounded font-mono text-center border-0 focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                            <input type="range" min={0} max={50} step={0.1} value={matteEdge} onChange={e=>setMatteEdge(Number(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                        </label>

                                        <label className="block text-xs space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-blue-200 font-medium flex items-center gap-1">
                                                    Choke
                                                    <span className="text-gray-400 cursor-help" title="Shrink (+) or expand (-) edges">ⓘ</span>
                                                </span>
                                                <input 
                                                    type="number" 
                                                    min={-10} 
                                                    max={10} 
                                                    step={0.1}
                                                    value={edgeChoke.toFixed(1)} 
                                                    onChange={e=>setEdgeChoke(Number(e.target.value))}
                                                    onWheel={e=>{ e.stopPropagation(); setEdgeChoke(Math.max(-10, Math.min(10, edgeChoke + (e.deltaY < 0 ? 0.1 : -0.1)))); }}
                                                    onFocus={e=>e.currentTarget.addEventListener('wheel', (ev) => ev.preventDefault(), {passive: false})}
                                                    onBlur={e=>e.currentTarget.removeEventListener('wheel', (ev) => ev.preventDefault())}
                                                    className="w-16 px-1.5 py-0.5 bg-purple-700/50 text-purple-100 text-xs rounded font-mono text-center border-0 focus:ring-1 focus:ring-purple-500"
                                                />
                                            </div>
                                            <input type="range" min={-10} max={10} step={0.1} value={edgeChoke} onChange={e=>setEdgeChoke(Number(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                                        </label>

                                        <label className="block text-xs space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-blue-200 font-medium flex items-center gap-1">
                                                    SSAA Quality
                                                    <span className="text-gray-400 cursor-help" title="Super-Sampling Anti-Aliasing: 0=Off, 2=2x, 3=3x, 4=4x (smooth edges)">ⓘ</span>
                                                </span>
                                                <input 
                                                    type="number" 
                                                    min={0} 
                                                    max={4} 
                                                    step={1}
                                                    value={ssaaQuality} 
                                                    onChange={e=>setSsaaQuality(Number(e.target.value))}
                                                    onWheel={e=>{ e.stopPropagation(); setSsaaQuality(Math.max(0, Math.min(4, ssaaQuality + (e.deltaY < 0 ? 1 : -1)))); }}
                                                    onFocus={e=>e.currentTarget.addEventListener('wheel', (ev) => ev.preventDefault(), {passive: false})}
                                                    onBlur={e=>e.currentTarget.removeEventListener('wheel', (ev) => ev.preventDefault())}
                                                    className="w-16 px-1.5 py-0.5 bg-blue-700/50 text-blue-100 text-xs rounded font-mono text-center border-0 focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                            <input type="range" min={0} max={4} step={1} value={ssaaQuality} onChange={e=>setSsaaQuality(Number(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                        </label>

                                        <label className="block text-xs space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-blue-200 font-medium flex items-center gap-1">
                                                    Decontamin.
                                                    <span className="text-gray-400 cursor-help" title="Removes chroma color spill/bleed (0-20)">ⓘ</span>
                                                </span>
                                                <input 
                                                    type="number" 
                                                    min={0} 
                                                    max={20} 
                                                    step={0.1}
                                                    value={decontamination.toFixed(1)} 
                                                    onChange={e=>setDecontamination(Number(e.target.value))}
                                                    onWheel={e=>{ e.stopPropagation(); setDecontamination(Math.max(0, Math.min(20, decontamination + (e.deltaY < 0 ? 0.1 : -0.1)))); }}
                                                    onFocus={e=>e.currentTarget.addEventListener('wheel', (ev) => ev.preventDefault(), {passive: false})}
                                                    onBlur={e=>e.currentTarget.removeEventListener('wheel', (ev) => ev.preventDefault())}
                                                    className="w-16 px-1.5 py-0.5 bg-blue-700/50 text-blue-100 text-xs rounded font-mono text-center border-0 focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                            <input type="range" min={0} max={20} step={0.1} value={decontamination} onChange={e=>setDecontamination(Number(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                        </label>
                                    </div>

                                    {/* Corner refinement controls */}
                                    <div className="pt-2 mt-2 border-t border-purple-700/20">
                                        <h5 className="text-xs text-purple-300 font-medium mb-2">Corner Precision</h5>
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                                            <label className="block text-xs space-y-1">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-purple-200 font-medium flex items-center gap-1">
                                                        Smoothing
                                                        <span className="text-gray-400 cursor-help" title="Reduces corner jaggedness">ⓘ</span>
                                                    </span>
                                                    <input 
                                                        type="number" 
                                                        min={0} 
                                                        max={20} 
                                                        step={0.1}
                                                        value={cornerSmoothing.toFixed(1)} 
                                                        onChange={e=>setCornerSmoothing(Number(e.target.value))}
                                                        onWheel={e=>{ e.stopPropagation(); setCornerSmoothing(Math.max(0, Math.min(20, cornerSmoothing + (e.deltaY < 0 ? 0.1 : -0.1)))); }}
                                                        onFocus={e=>e.currentTarget.addEventListener('wheel', (ev) => ev.preventDefault(), {passive: false})}
                                                        onBlur={e=>e.currentTarget.removeEventListener('wheel', (ev) => ev.preventDefault())}
                                                        className="w-16 px-1.5 py-0.5 bg-purple-700/50 text-purple-100 text-xs rounded font-mono text-center border-0 focus:ring-1 focus:ring-purple-500"
                                                    />
                                                </div>
                                                <input type="range" min={0} max={20} step={0.1} value={cornerSmoothing} onChange={e=>setCornerSmoothing(Number(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                                            </label>

                                            <label className="block text-xs space-y-1">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-purple-200 font-medium flex items-center gap-1">
                                                        Refinement
                                                        <span className="text-gray-400 cursor-help" title="Fills concave corner dents">ⓘ</span>
                                                    </span>
                                                    <input 
                                                        type="number" 
                                                        min={0} 
                                                        max={50} 
                                                        value={cornerRefinement} 
                                                        onChange={e=>setCornerRefinement(Number(e.target.value))}
                                                        onWheel={e=>{ e.stopPropagation(); setCornerRefinement(Math.max(0, Math.min(50, cornerRefinement + (e.deltaY < 0 ? 1 : -1)))); }}
                                                        onFocus={e=>e.currentTarget.addEventListener('wheel', (ev) => ev.preventDefault(), {passive: false})}
                                                        onBlur={e=>e.currentTarget.removeEventListener('wheel', (ev) => ev.preventDefault())}
                                                        className="w-16 px-1.5 py-0.5 bg-purple-700/50 text-purple-100 text-xs rounded font-mono text-center border-0 focus:ring-1 focus:ring-purple-500"
                                                    />
                                                </div>
                                                <input type="range" min={0} max={50} step={1} value={cornerRefinement} onChange={e=>setCornerRefinement(Number(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                                            </label>

                                            <label className="block text-xs space-y-1 col-span-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-purple-200 font-medium flex items-center gap-1">
                                                        Artifact Cleanup
                                                        <span className="text-gray-400 cursor-help" title="Removes pixel noise">ⓘ</span>
                                                    </span>
                                                    <input 
                                                        type="number" 
                                                        min={0} 
                                                        max={5} 
                                                        value={artifactCleanupSize} 
                                                        onChange={e=>setArtifactCleanupSize(Number(e.target.value))}
                                                        onWheel={e=>{ e.stopPropagation(); setArtifactCleanupSize(Math.max(0, Math.min(5, artifactCleanupSize + (e.deltaY < 0 ? 1 : -1)))); }}
                                                        onFocus={e=>e.currentTarget.addEventListener('wheel', (ev) => ev.preventDefault(), {passive: false})}
                                                        onBlur={e=>e.currentTarget.removeEventListener('wheel', (ev) => ev.preventDefault())}
                                                        className="w-16 px-1.5 py-0.5 bg-purple-700/50 text-purple-100 text-xs rounded font-mono text-center border-0 focus:ring-1 focus:ring-purple-500"
                                                    />
                                                </div>
                                                <input type="range" min={0} max={5} step={1} value={artifactCleanupSize} onChange={e=>setArtifactCleanupSize(Number(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                                            </label>
                                        </div>
                                    </div>

                                    {/* Rotation controls */}
                                    <div className="pt-2 mt-2 border-t border-purple-700/20">
                                        <h5 className="text-xs text-purple-300 font-medium mb-2">Rotation Adjustment</h5>
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 text-xs">
                                                <input 
                                                    type="checkbox" 
                                                    checked={autoRotate} 
                                                    onChange={e => setAutoRotate(e.target.checked)}
                                                    className="w-3.5 h-3.5 accent-purple-500"
                                                />
                                                <span className="text-purple-200">Auto-detect rotation</span>
                                                <span className="text-gray-400 cursor-help" title="Automatically detect and correct tilted designs">ⓘ</span>
                                            </label>

                                            <label className="block text-xs space-y-1">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-purple-200 font-medium flex items-center gap-1">
                                                        Rotation Angle (°)
                                                        <span className="text-gray-400 cursor-help" title="Manual rotation angle (-180° to +180°)">ⓘ</span>
                                                    </span>
                                                    <input 
                                                        type="number" 
                                                        min={-180} 
                                                        max={180} 
                                                        step={0.01}
                                                        value={rotationAngle.toFixed(2)} 
                                                        onChange={e=>setRotationAngle(Number(e.target.value))}
                                                        onWheel={e=>{ e.stopPropagation(); setRotationAngle(Math.max(-180, Math.min(180, rotationAngle + (e.deltaY < 0 ? 0.1 : -0.1)))); }}
                                                        onFocus={e=>e.currentTarget.addEventListener('wheel', (ev) => ev.preventDefault(), {passive: false})}
                                                        onBlur={e=>e.currentTarget.removeEventListener('wheel', (ev) => ev.preventDefault())}
                                                        className="w-20 px-1.5 py-0.5 bg-purple-700/50 text-purple-100 text-xs rounded font-mono text-center border-0 focus:ring-1 focus:ring-purple-500"
                                                    />
                                                </div>
                                                <input 
                                                    type="range" 
                                                    min={-180} 
                                                    max={180} 
                                                    step={0.01} 
                                                    value={rotationAngle} 
                                                    onChange={e=>setRotationAngle(Number(e.target.value))} 
                                                    className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" 
                                                />
                                            </label>

                                            {rotationAngle !== 0 && (
                                                <button
                                                    onClick={() => setRotationAngle(0)}
                                                    className="w-full px-2 py-1 bg-purple-700/50 hover:bg-purple-600/50 text-purple-100 text-xs rounded transition-colors"
                                                >
                                                    Reset Rotation
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>}
                            </div>
                        </div>

                        <div className="pt-3 border-t border-blue-700/50 space-y-2">
                            {tuningDirty && !isReprocessing && (
                                <div className="text-xs text-center text-amber-300 bg-amber-900/30 py-1.5 rounded animate-pulse">
                                    ⚠️ Settings changed - Click "Download High-Res" to export with new settings
                                </div>
                            )}
                            {isProcessingPreview && (
                                <div className="text-xs text-center bg-blue-900/30 py-2 rounded space-y-2">
                                    <div className="text-blue-300">
                                        {isRenderingResult ? (
                                            <>🎨 Rendering preview...</>
                                        ) : (
                                            <>⚡ Processing full resolution {processingProgress > 0 && `(${processingProgress}%)`}</>
                                        )}
                                    </div>
                                    {!isRenderingResult && processingProgress > 0 && (
                                        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                                            <div 
                                                className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full transition-all duration-300 ease-out"
                                                style={{ width: `${processingProgress}%` }}
                                            />
                                        </div>
                                    )}
                                    {isRenderingResult && (
                                        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                                            <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-full animate-pulse" style={{ width: '100%' }} />
                                        </div>
                                    )}
                                    <div className="text-gray-400 text-[10px]">
                                        {isRenderingResult ? 'Converting to preview format...' : 'UI stays responsive • Worker thread active'}
                                    </div>
                                </div>
                            )}
                            <button onClick={applyFinal} disabled={isReprocessing || !upscaledImage} className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-emerald-500/50 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                {isReprocessing ? '⏳ Exporting...' : tuningDirty ? '� Download High-Res (Apply Settings)' : '� Download High-Res (4500x5100)'}
                            </button>
                            <button onClick={reset} className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-blue-500/50 hover:scale-[1.02] transition-all">🔄 Start Over</button>
                            {jobStatus && <div className="text-xs text-center text-blue-300 bg-blue-900/30 py-1.5 rounded">Job: {jobId?.split('-')[0]} — {jobStatus}</div>}
                            {jobResultUrl && <a className="block text-xs text-center text-emerald-400 hover:text-emerald-300 underline py-1" href={jobResultUrl} target="_blank" rel="noreferrer" download={`cutout_${Date.now()}.${outputFormat === 'tiff-cmyk' ? 'tif' : 'png'}`}>⬇️ Download final result (if auto-download failed)</a>}
                            {toast && <div className="text-xs text-center text-emerald-300 bg-emerald-900/30 py-1.5 rounded animate-pulse">{toast}</div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CloneMode;
