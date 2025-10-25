import React, { useRef, useEffect, useState } from 'react';
import { type Tool, type CanvasObjectType, type PathObject, type RectObject, type LineObject, type ImageObject, type TextObject } from '../types';
import { type AspectRatio } from '../App';
import { RotateIcon } from '../constants';
import ImageContextMenu from './ImageContextMenu';

interface CanvasProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  objects: CanvasObjectType[];
  setObjects: (updater: React.SetStateAction<CanvasObjectType[]>, addToHistory?: boolean) => void;
  selectedObjectId: string | null;
  setSelectedObjectId: (id: string | null) => void;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  opacity: number;
  setOpacity: (opacity: number) => void;
  onTextDoubleClick: (object: TextObject) => void;
  onImageDrop: (dataUrl: string) => void;
  editingText: TextObject | null;
  viewTransform: { scale: number; offsetX: number; offsetY: number; };
  setViewTransform: React.Dispatch<React.SetStateAction<{ scale: number; offsetX: number; offsetY: number; }>>;
  isSpacebarDown: boolean;
  onOpenMaskPrompt: (objectId: string, clientX: number, clientY: number) => void;
  onAIEraserFinish: (mask: PathObject) => void;
  canvasMode: 'canvas' | 'edit';
  textAlign: 'left' | 'center' | 'right';
  textFontSize: number;
  cropAspectRatio: AspectRatio;
  cropRect: RectObject | null;
  onCropRectChange: (rect: RectObject | null) => void;
}

type Interaction = 
  | { type: 'none' }
  | { type: 'drawing'; tool: 'brush' | 'line' | 'rect' | 'eraser' | 'text' | 'ai_eraser'; startX: number; startY: number; clientX: number, clientY: number; tempObject: PathObject | RectObject | LineObject }
  | { type: 'moving'; objectId: string; startX: number; startY: number; originalObject: CanvasObjectType }
  | { type: 'resizing'; objectId: string; handle: string; startX: number; startY: number; originalObject: ImageObject | RectObject | TextObject | LineObject }
  | { type: 'rotating'; objectId: string; centerX: number; centerY: number; startAngle: number; originalRotation: number }
  | { type: 'panning'; startX: number; startY: number; startOffsetX: number; startOffsetY: number }
  | { type: 'adjusting_brush'; startX: number; startY: number; originalWidth: number; originalOpacity: number; clientX: number; clientY: number; }
  | { type: 'resizing_crop'; handle: string; startX: number; startY: number; originalRect: RectObject }
  | { type: 'moving_crop'; startX: number; startY: number; originalRect: RectObject };


type SnapGuide = {
    type: 'vertical' | 'horizontal';
    x?: number; // for vertical lines
    y?: number; // for horizontal lines
    start: number; // y-coord for vertical, x-coord for horizontal
    end: number;   // y-coord for vertical, x-coord for horizontal
};

type BoundingBox = { x: number; y: number; width: number; height: number; };

const RESIZE_HANDLE_SIZE = 8;
const ROTATION_HANDLE_OFFSET = 20;
const ROTATION_HANDLE_MARGIN = 15;
const SNAP_THRESHOLD = 6; // in screen pixels

const getObjectBoundingBox = (obj: CanvasObjectType): BoundingBox | null => {
    const rotation = 'rotation' in obj ? obj.rotation : 0;
    if (rotation !== 0 && ('width' in obj) && ('height' in obj)) {
         const rad = rotation * Math.PI / 180;
         const c = Math.cos(rad);
         const s = Math.sin(rad);
         const cx = obj.x + obj.width / 2;
         const cy = obj.y + obj.height / 2;
         const w = obj.width / 2;
         const h = obj.height / 2;
         const corners = [ { x: -w, y: -h }, { x: w, y: -h }, { x: w, y: h }, { x: -w, y: h }];
         let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
         corners.forEach(p => {
             const rotatedX = p.x * c - p.y * s + cx;
             const rotatedY = p.x * s + p.y * c + cy;
             minX = Math.min(minX, rotatedX);
             maxX = Math.max(maxX, rotatedX);
             minY = Math.min(minY, rotatedY);
             maxY = Math.max(maxY, rotatedY);
         });
         return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    switch (obj.type) {
        case 'image':
        case 'rect':
        case 'text':
            return { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
        case 'path': {
            if (obj.points.length === 0) return null;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            obj.points.forEach(p => {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            });
            const halfStroke = obj.strokeWidth / 2;
            return {
                x: minX - halfStroke,
                y: minY - halfStroke,
                width: (maxX - minX) + obj.strokeWidth,
                height: (maxY - minY) + obj.strokeWidth,
            };
        }
        case 'line': {
            const minX = Math.min(obj.x1, obj.x2);
            const minY = Math.min(obj.y1, obj.y2);
            const maxX = Math.max(obj.x1, obj.x2);
            const maxY = Math.max(obj.y1, obj.y2);
            const buffer = (8 + obj.strokeWidth * 2);
            return {
                x: minX - buffer,
                y: minY - buffer,
                width: (maxX - minX) + buffer * 2,
                height: (maxY - minY) + buffer * 2,
            };
        }
        default:
            return null;
    }
}

const getSnappingAndGuides = (
    movingBox: BoundingBox,
    staticObjects: CanvasObjectType[],
    scale: number
): { snapAdjustment: { x: number, y: number }, guides: SnapGuide[] } => {
    const snapThreshold = SNAP_THRESHOLD / scale;
    const guides: SnapGuide[] = [];
    const snapAdjustment = { x: 0, y: 0 };

    const movingPoints = {
        v: [movingBox.x, movingBox.x + movingBox.width / 2, movingBox.x + movingBox.width], // left, center, right
        h: [movingBox.y, movingBox.y + movingBox.height / 2, movingBox.y + movingBox.height]  // top, center, bottom
    };

    let bestSnapX = { dist: Infinity, adjustment: 0, guide: null as SnapGuide | null };
    let bestSnapY = { dist: Infinity, adjustment: 0, guide: null as SnapGuide | null };

    for (const staticObj of staticObjects) {
        const staticBox = getObjectBoundingBox(staticObj);
        if (!staticBox) continue;

        const staticPoints = {
            v: [staticBox.x, staticBox.x + staticBox.width / 2, staticBox.x + staticBox.width],
            h: [staticBox.y, staticBox.y + staticBox.height / 2, staticBox.y + staticBox.height]
        };
        
        for (const movingX of movingPoints.v) {
            for (const staticX of staticPoints.v) {
                const dist = Math.abs(movingX - staticX);
                if (dist < snapThreshold && dist < bestSnapX.dist) {
                    bestSnapX = {
                        dist,
                        adjustment: staticX - movingX,
                        guide: {
                            type: 'vertical',
                            x: staticX,
                            start: Math.min(movingBox.y, staticBox.y),
                            end: Math.max(movingBox.y + movingBox.height, staticBox.y + staticBox.height)
                        }
                    };
                }
            }
        }
        
        for (const movingY of movingPoints.h) {
            for (const staticY of staticPoints.h) {
                const dist = Math.abs(movingY - staticY);
                if (dist < snapThreshold && dist < bestSnapY.dist) {
                    bestSnapY = {
                        dist,
                        adjustment: staticY - movingY,
                        guide: {
                            type: 'horizontal',
                            y: staticY,
                            start: Math.min(movingBox.x, staticBox.x),
                            end: Math.max(movingBox.x + movingBox.width, staticBox.x + staticBox.width)
                        }
                    };
                }
            }
        }
    }

    if (bestSnapX.adjustment !== 0 && bestSnapX.guide) {
        snapAdjustment.x = bestSnapX.adjustment;
        guides.push(bestSnapX.guide);
    }
    if (bestSnapY.adjustment !== 0 && bestSnapY.guide) {
        snapAdjustment.y = bestSnapY.adjustment;
        guides.push(bestSnapY.guide);
    }

    return { snapAdjustment, guides };
};


const hexToRgba = (hex: string, opacity: number) => {
    if (!hex.startsWith('#')) return hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const getCursorStyle = (
    tool: Tool,
    overObject: boolean,
    handle: string | null | undefined,
    isSpacebarDown: boolean | undefined,
    interaction: Interaction,
    brushSize: number,
    scale: number,
    color: string
): string => {
    if (interaction.type === 'panning') return 'grabbing';
    if (interaction.type === 'adjusting_brush') return 'none'; // Hide cursor during adjustment
    if (isSpacebarDown) return 'grab';
    if (handle) {
        if (handle.startsWith('rotate')) return 'grabbing'; // Or a custom rotation cursor
        if (handle === 'start' || handle === 'end') return 'pointer';
        switch (handle) {
            case 'topLeft': case 'bottomRight': return 'nwse-resize';
            case 'topRight': case 'bottomLeft': return 'nesw-resize';
            case 'top': case 'bottom': return 'ns-resize';
            case 'left': case 'right': return 'ew-resize';
            default: return 'move';
        }
    }
    switch (tool) {
        case 'send': return overObject ? 'move' : 'default';
        case 'brush':
        case 'eraser':
        case 'ai_eraser': {
            // IMPROVED: Enhanced cursor with precise crosshair for better positioning
            const brushCircleSize = Math.max(8, Math.min(128, Math.round(brushSize * scale)));
            const brushRadius = brushCircleSize / 2;
            
            // Crosshair extends beyond brush circle for better visibility
            const crosshairExtension = 8;
            const totalSize = brushCircleSize + (crosshairExtension * 2);
            const center = totalSize / 2;
            
            // Different colors for different tools
            let strokeColor = 'rgba(0,0,0,0.9)';
            let circleStrokeWidth = 1.5;
            let fillColor = hexToRgba(color, 0.25);
            
            if (tool === 'eraser') {
                strokeColor = 'rgba(255,0,0,0.9)';
                fillColor = 'rgba(255,0,0,0.15)';
                circleStrokeWidth = 2;
            } else if (tool === 'ai_eraser') {
                strokeColor = 'rgba(139,92,246,0.9)'; // Purple
                fillColor = 'rgba(139,92,246,0.15)';
                circleStrokeWidth = 1.5;
            }
            
            // Create enhanced SVG cursor with precise crosshair
            const svg = `<svg width="${totalSize}" height="${totalSize}" xmlns="http://www.w3.org/2000/svg">
                <!-- Brush size circle -->
                <circle cx="${center}" cy="${center}" r="${brushRadius - 1}" 
                        stroke="${strokeColor}" stroke-width="${circleStrokeWidth}" fill="${fillColor}"/>
                
                <!-- Extended crosshair lines for precision -->
                <line x1="${center}" y1="0" x2="${center}" y2="${totalSize}" 
                      stroke="${strokeColor}" stroke-width="1.5" opacity="0.7"/>
                <line x1="0" y1="${center}" x2="${totalSize}" y2="${center}" 
                      stroke="${strokeColor}" stroke-width="1.5" opacity="0.7"/>
                
                <!-- Center dot for exact positioning -->
                <circle cx="${center}" cy="${center}" r="2" fill="${strokeColor}"/>
            </svg>`;
            
            // CRITICAL: Hotspot must be at exact center
            return `url('data:image/svg+xml;base64,${btoa(svg)}') ${center} ${center}, crosshair`;
        }
        case 'line':
        case 'rect':
            return 'crosshair';
        case 'crop':
             return handle ? getCursorStyle('send', true, handle, false, interaction, 0, 1, '') : 'move';
        case 'text': return 'text';
        default: return 'default';
    }
};

const Canvas: React.FC<CanvasProps> = ({ activeTool, setActiveTool, objects, setObjects, selectedObjectId, setSelectedObjectId, strokeColor, fillColor, strokeWidth, setStrokeWidth, opacity, setOpacity, onTextDoubleClick, onImageDrop, editingText, viewTransform, setViewTransform, isSpacebarDown, onOpenMaskPrompt, onAIEraserFinish, canvasMode, textAlign, textFontSize, cropAspectRatio, cropRect, onCropRectChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const [interaction, setInteraction] = useState<Interaction>({ type: 'none' });
  const [cursor, setCursor] = useState('default');
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    targetImage: ImageObject | null;
  }>({ visible: false, x: 0, y: 0, targetImage: null });


    const DEBUG_CURSOR = false;

    const getCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - viewTransform.offsetX) / viewTransform.scale;
    const y = (clientY - rect.top - viewTransform.offsetY) / viewTransform.scale;
        if (DEBUG_CURSOR) {
            // Helpful debug for mismatched coordinates
            // Note: clientX/Y and rect are in CSS pixels, offsetX/Y are stored in CSS pixels
            // Drawing uses a composed transform: device = dpr * (scale * world + offset)
            const dpr = window.devicePixelRatio || 1;
            // Device space locations (for sanity check only)
            const deviceX = dpr * (viewTransform.scale * x + viewTransform.offsetX);
            const deviceY = dpr * (viewTransform.scale * y + viewTransform.offsetY);
            console.log('📍 getCanvasCoords', {
                client: { x: clientX, y: clientY },
                rect: { left: rect.left, top: rect.top },
                screenCss: { x: clientX - rect.left, y: clientY - rect.top },
                world: { x, y },
                transform: viewTransform,
                dpr,
                device: { x: Math.round(deviceX), y: Math.round(deviceY) }
            });
        }
    return { x, y };
  };
  
  const drawObject = (ctx: CanvasRenderingContext2D, obj: CanvasObjectType) => {
    if (obj.visible === false) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const rotation = 'rotation' in obj ? obj.rotation : 0;
    if (rotation !== 0 && 'x' in obj && 'y' in obj && 'width' in obj && 'height' in obj) {
        const centerX = obj.x + obj.width / 2;
        const centerY = obj.y + obj.height / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation * Math.PI / 180);
        ctx.translate(-centerX, -centerY);
    }
    
    switch (obj.type) {
      case 'image':
        const img = imageCache.current.get(obj.src);
        if (img) ctx.drawImage(img, obj.x, obj.y, obj.width, obj.height);
        break;
      case 'path':
        ctx.globalAlpha = obj.opacity ?? 1;
        ctx.strokeStyle = obj.strokeColor;
        ctx.lineWidth = obj.strokeWidth;
        ctx.beginPath();
        
        if (obj.points.length < 2) {
            if(obj.points.length === 1) {
                // Draw a dot for a single point
                const p = obj.points[0];
                ctx.fillStyle = obj.strokeColor;
                ctx.arc(p.x, p.y, obj.strokeWidth / 2, 0, 2 * Math.PI);
                ctx.fill();
            }
        } else if (obj.points.length === 2) {
            // Just a straight line for two points
            ctx.moveTo(obj.points[0].x, obj.points[0].y);
            ctx.lineTo(obj.points[1].x, obj.points[1].y);
        } else {
            // Use quadratic curves for 3+ points for smoothing
            ctx.moveTo(obj.points[0].x, obj.points[0].y);
            let i;
            for (i = 1; i < obj.points.length - 2; i++) {
                const xc = (obj.points[i].x + obj.points[i + 1].x) / 2;
                const yc = (obj.points[i].y + obj.points[i + 1].y) / 2;
                ctx.quadraticCurveTo(obj.points[i].x, obj.points[i].y, xc, yc);
            }
            // For the last segment, curve to the final point
            ctx.quadraticCurveTo(
                obj.points[i].x,
                obj.points[i].y,
                obj.points[i + 1].x,
                obj.points[i + 1].y
            );
        }
        
        ctx.stroke();
        break;
      case 'rect':
        ctx.globalAlpha = obj.opacity ?? 1;
        if(obj.fillColor) {
            ctx.fillStyle = obj.fillColor;
            ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
        }
        if (obj.strokeWidth > 0) {
          ctx.strokeStyle = obj.strokeColor;
          ctx.lineWidth = obj.strokeWidth;
          ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
        }
        break;
      case 'line': {
         ctx.globalAlpha = obj.opacity ?? 1;
         const headlen = 8 + obj.strokeWidth * 2;
         const angle = Math.atan2(obj.y2 - obj.y1, obj.x2 - obj.x1);
         const lineLength = Math.hypot(obj.x2 - obj.x1, obj.y2 - obj.y1);
         const arrowHeight = headlen * Math.cos(Math.PI / 6);
         
         if (lineLength > arrowHeight) {
            const lineEndX = obj.x2 - arrowHeight * Math.cos(angle);
            const lineEndY = obj.y2 - arrowHeight * Math.sin(angle);
    
            ctx.beginPath();
            ctx.moveTo(obj.x1, obj.y1);
            ctx.lineTo(lineEndX, lineEndY);
            ctx.strokeStyle = obj.strokeColor;
            ctx.lineWidth = obj.strokeWidth;
            ctx.stroke();
         }

         ctx.beginPath();
         ctx.moveTo(obj.x2, obj.y2);
         ctx.lineTo(obj.x2 - headlen * Math.cos(angle - Math.PI / 6), obj.y2 - headlen * Math.sin(angle - Math.PI / 6));
         ctx.lineTo(obj.x2 - headlen * Math.cos(angle + Math.PI / 6), obj.y2 - headlen * Math.sin(angle + Math.PI / 6));
         ctx.closePath();
         ctx.fillStyle = obj.strokeColor;
         ctx.fill();
         break;
      }
      case 'text':
        ctx.fillStyle = obj.strokeColor;
        ctx.font = `${obj.fontSize}px sans-serif`;
        ctx.textAlign = obj.align || 'left';
        ctx.textBaseline = 'top';
        
        let textX;
        switch(obj.align) {
            case 'center':
                textX = obj.x + obj.width / 2;
                break;
            case 'right':
                textX = obj.x + obj.width;
                break;
            case 'left':
            default:
                textX = obj.x;
                break;
        }

        const lines = obj.text.split('\n');
        let currentY = obj.y;
        const lineHeight = obj.fontSize * 1.2;

        lines.forEach(line => {
            let currentLine = '';
            const words = line.split(' ');
            for (let i = 0; i < words.length; i++) {
                const testLine = currentLine + words[i] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > obj.width && i > 0) {
                    ctx.fillText(currentLine, textX, currentY);
                    currentLine = words[i] + ' ';
                    currentY += lineHeight;
                } else {
                    currentLine = testLine;
                }
            }
            ctx.fillText(currentLine, textX, currentY);
            currentY += lineHeight;
        });
        break;
    }
    ctx.restore();
    ctx.globalAlpha = 1.0;
  };

  const rasterizeAndErase = async (targetObject: CanvasObjectType, erasePath: PathObject): Promise<ImageObject> => {
    const bbox = getObjectBoundingBox(targetObject);
    if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
        return {
            id: targetObject.id, type: 'image', src: '',
            x: ('x' in targetObject ? targetObject.x : 0),
            y: ('y' in targetObject ? targetObject.y : 0),
            width: 0, height: 0, visible: false, rotation: 0,
        };
    }

    const offscreenCanvas = document.createElement('canvas');
    const padding = 2;
    offscreenCanvas.width = Math.ceil(bbox.width + padding * 2);
    offscreenCanvas.height = Math.ceil(bbox.height + padding * 2);
    const ctx = offscreenCanvas.getContext('2d');
    if (!ctx) throw new Error("Could not create offscreen context");

    ctx.translate(-bbox.x + padding, -bbox.y + padding);

    // Ensure image is loaded before drawing
    if (targetObject.type === 'image' && !imageCache.current.has(targetObject.src)) {
        await new Promise<void>(resolve => {
            const img = new Image();
            img.src = targetObject.src;
            img.onload = () => {
                imageCache.current.set(targetObject.src, img);
                resolve();
            };
        });
    }

    drawObject(ctx, targetObject);
    ctx.globalCompositeOperation = 'destination-out';
    drawObject(ctx, erasePath);

    const newSrc = offscreenCanvas.toDataURL();

    return {
        id: targetObject.id,
        type: 'image',
        src: newSrc,
        x: bbox.x - padding,
        y: bbox.y - padding,
        width: offscreenCanvas.width,
        height: offscreenCanvas.height,
        visible: true,
        rotation: 0, // Erasing resets rotation
    };
  };

  useEffect(() => {
    objects.forEach(obj => {
      if (obj.type === 'image' && !imageCache.current.has(obj.src)) {
        const img = new Image();
        img.src = obj.src;
        img.onload = () => {
          imageCache.current.set(obj.src, img);
          drawCanvas();
        };
      }
    });
  }, [objects]);

  const drawSelectionHandles = (ctx: CanvasRenderingContext2D, obj: CanvasObjectType) => {
    if (obj.visible === false) return;
    
    const handleSize = RESIZE_HANDLE_SIZE / viewTransform.scale;
    const rotHandleOffset = ROTATION_HANDLE_OFFSET / viewTransform.scale;

    if (obj.type === 'line') {
        const { x1, y1, x2, y2 } = obj;
        ctx.fillStyle = '#007bff';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1 / viewTransform.scale;

        ctx.beginPath();
        ctx.arc(x1, y1, handleSize / 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x2, y2, handleSize / 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        return;
    }
      
    if (obj.type !== 'image' && obj.type !== 'rect' && obj.type !== 'text') return;
    
    const { x, y, width, height } = obj;
    const rotation = 'rotation' in obj ? obj.rotation : 0;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    const isEditing = editingText && obj.id === editingText.id;
    
    ctx.strokeStyle = '#007bff';
    ctx.lineWidth = 1 / viewTransform.scale;

    ctx.setLineDash(isEditing ? [5 / viewTransform.scale, 5 / viewTransform.scale] : []);
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]);


    const handles = {
        topLeft: { x: x, y: y }, topRight: { x: x + width, y: y },
        bottomLeft: { x: x, y: y + height }, bottomRight: { x: x + width, y: y + height },
        top: { x: x + width / 2, y: y }, bottom: { x: x + width / 2, y: y + height },
        left: { x: x, y: y + height / 2 }, right: { x: x + width, y: y + height / 2 },
    };

    ctx.fillStyle = '#007bff';
    Object.values(handles).forEach(pos => {
        ctx.fillRect(pos.x - handleSize / 2, pos.y - handleSize / 2, handleSize, handleSize);
    });

    if(obj.type === 'text' || obj.type === 'image' || obj.type === 'rect') {
        const rotationHandleY = y - rotHandleOffset;
        ctx.beginPath();
        ctx.moveTo(x + width / 2, y);
        ctx.lineTo(x + width / 2, rotationHandleY);
        ctx.strokeStyle = '#007bff';
        ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.strokeStyle = '#007bff';
        ctx.beginPath();
        ctx.arc(x + width / 2, rotationHandleY, handleSize / 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();
  }
  
  const drawCropHandles = (ctx: CanvasRenderingContext2D, rect: RectObject) => {
    const { x, y, width, height } = rect;
    const handleLSize = 15 / viewTransform.scale;
    const handleThickness = 3 / viewTransform.scale;
    const sideHandleLength = 20 / viewTransform.scale;

    // Thin border for the rect itself
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1 / viewTransform.scale;
    ctx.strokeRect(x, y, width, height);
    
    // Draw grid lines inside
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(x + width / 3, y);
    ctx.lineTo(x + width / 3, y + height);
    ctx.moveTo(x + (width / 3) * 2, y);
    ctx.lineTo(x + (width / 3) * 2, y + height);
    ctx.moveTo(x, y + height / 3);
    ctx.lineTo(x + width, y + height / 3);
    ctx.moveTo(x, y + (height / 3) * 2);
    ctx.lineTo(x + width, y + (height / 3) * 2);
    ctx.stroke();

    // Draw thick corner and side handles
    ctx.strokeStyle = 'white';
    ctx.lineWidth = handleThickness;
    ctx.beginPath();

    // Corner handles
    const corners = {
        tl: { x, y },
        tr: { x: x + width, y },
        bl: { x, y: y + height },
        br: { x: x + width, y: y + height }
    };
    // TL
    ctx.moveTo(corners.tl.x + handleLSize, corners.tl.y);
    ctx.lineTo(corners.tl.x, corners.tl.y);
    ctx.lineTo(corners.tl.x, corners.tl.y + handleLSize);
    // TR
    ctx.moveTo(corners.tr.x - handleLSize, corners.tr.y);
    ctx.lineTo(corners.tr.x, corners.tr.y);
    ctx.lineTo(corners.tr.x, corners.tr.y + handleLSize);
    // BL
    ctx.moveTo(corners.bl.x + handleLSize, corners.bl.y);
    ctx.lineTo(corners.bl.x, corners.bl.y);
    ctx.lineTo(corners.bl.x, corners.bl.y - handleLSize);
    // BR
    ctx.moveTo(corners.br.x - handleLSize, corners.br.y);
    ctx.lineTo(corners.br.x, corners.br.y);
    ctx.lineTo(corners.br.x, corners.br.y - handleLSize);
    
    // Side handles
    const midPoints = {
        top: { x: x + width / 2, y: y },
        bottom: { x: x + width / 2, y: y + height },
        left: { x: x, y: y + height / 2 },
        right: { x: x + width, y: y + height / 2 }
    };
    // Top
    ctx.moveTo(midPoints.top.x - sideHandleLength / 2, midPoints.top.y);
    ctx.lineTo(midPoints.top.x + sideHandleLength / 2, midPoints.top.y);
    // Bottom
    ctx.moveTo(midPoints.bottom.x - sideHandleLength / 2, midPoints.bottom.y);
    ctx.lineTo(midPoints.bottom.x + sideHandleLength / 2, midPoints.bottom.y);
    // Left
    ctx.moveTo(midPoints.left.x, midPoints.left.y - sideHandleLength / 2);
    ctx.lineTo(midPoints.left.x, midPoints.left.y + sideHandleLength / 2);
    // Right
    ctx.moveTo(midPoints.right.x, midPoints.right.y - sideHandleLength / 2);
    ctx.lineTo(midPoints.right.x, midPoints.right.y + sideHandleLength / 2);

    ctx.stroke();
  };


    const drawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    
        const dpr = window.devicePixelRatio || 1;
        // 1) Reset and clear at device scale
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 2) Draw background in CSS pixel space (scaled by DPR)
        if (canvasMode === 'canvas') {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        } else {
            ctx.fillStyle = '#27272a'; // zinc-800
            ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        }

        // 3) Compose a single transform for world drawing:
        // device = dpr * (scale * world + offset)
        const sx = dpr * viewTransform.scale;
        const sy = dpr * viewTransform.scale;
        const tx = dpr * viewTransform.offsetX;
        const ty = dpr * viewTransform.offsetY;
        ctx.setTransform(sx, 0, 0, sy, tx, ty);

    objects.forEach(obj => {
        if (editingText && obj.id === editingText.id && obj.type === 'text') {
            return;
        }
        drawObject(ctx, obj);
    });

    if (interaction.type === 'drawing') {
        drawObject(ctx, interaction.tempObject);
    }
    
    ctx.save();
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 1 / viewTransform.scale;
    ctx.setLineDash([4 / viewTransform.scale, 4 / viewTransform.scale]);
    snapGuides.forEach(guide => {
        ctx.beginPath();
        if (guide.type === 'vertical' && guide.x !== undefined) {
            ctx.moveTo(guide.x, guide.start);
            ctx.lineTo(guide.x, guide.end);
        } else if (guide.type === 'horizontal' && guide.y !== undefined) {
            ctx.moveTo(guide.start, guide.y);
            ctx.lineTo(guide.end, guide.y);
        }
        ctx.stroke();
    });
    ctx.restore();
    
    const selectedObject = objects.find(obj => obj.id === selectedObjectId);
    if (selectedObject) {
        drawSelectionHandles(ctx, selectedObject);
    }

    if (interaction.type === 'adjusting_brush') {
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Use screen coordinates for feedback
        const { startX, startY, originalWidth, originalOpacity, clientX, clientY } = interaction;
        const dx = clientX - startX;
        const dy = clientY - startY;
        const newWidth = Math.max(1, Math.min(200, Math.round(originalWidth + dx)));
        const newOpacity = Math.max(0, Math.min(1, originalOpacity - dy / 200));
        
        const canvasRect = canvas.getBoundingClientRect();
        const relativeX = startX - canvasRect.left;
        const relativeY = startY - canvasRect.top;

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

        ctx.font = '14px sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(`Size: ${newWidth.toFixed(0)}`, relativeX, relativeY - 30);
        ctx.fillText(`Opacity: ${(newOpacity * 100).toFixed(0)}%`, relativeX, relativeY + 40);
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(relativeX, relativeY, newWidth / 2 * viewTransform.scale, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.restore();
    }

    if (editingText) {
      const editingObj = objects.find(obj => obj.id === editingText.id);
      if (editingObj) drawSelectionHandles(ctx, editingObj);
    }

    ctx.restore();

    // This must be drawn AFTER restoring the main context transform,
    // as it should be drawn on top of everything without being affected by zoom/pan.
    if (activeTool === 'crop' && cropRect) {
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Reset to screen space
        ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
        ctx.scale(viewTransform.scale, viewTransform.scale);
        
        const x = Math.min(cropRect.x, cropRect.x + cropRect.width);
        const y = Math.min(cropRect.y, cropRect.y + cropRect.height);
        const w = Math.abs(cropRect.width);
        const h = Math.abs(cropRect.height);
        const normalizedCropRect = { ...cropRect, x, y, width: w, height: h };

        // Define the viewport in world coordinates
        const worldRect = { 
            x: -viewTransform.offsetX / viewTransform.scale, 
            y: -viewTransform.offsetY / viewTransform.scale, 
            width: canvas.width / dpr / viewTransform.scale, 
            height: canvas.height / dpr / viewTransform.scale 
        };

        ctx.fillStyle = 'rgba(24, 24, 27, 0.6)';

        // Draw four rectangles for the overlay, leaving the crop area clear
        // Top rectangle
        ctx.fillRect(worldRect.x, worldRect.y, worldRect.width, normalizedCropRect.y - worldRect.y);
        // Bottom rectangle
        ctx.fillRect(worldRect.x, normalizedCropRect.y + normalizedCropRect.height, worldRect.width, (worldRect.y + worldRect.height) - (normalizedCropRect.y + normalizedCropRect.height));
        // Left rectangle
        ctx.fillRect(worldRect.x, normalizedCropRect.y, normalizedCropRect.x - worldRect.x, normalizedCropRect.height);
        // Right rectangle
        ctx.fillRect(normalizedCropRect.x + normalizedCropRect.width, normalizedCropRect.y, (worldRect.x + worldRect.width) - (normalizedCropRect.x + normalizedCropRect.width), normalizedCropRect.height);
        
        // Draw the crop handles and grid on top.
        drawCropHandles(ctx, normalizedCropRect);

        ctx.restore();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = containerRef.current;
    if (!container) return;

    const setupCanvas = () => {
        const { width, height } = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        drawCanvas();
    };
    
    setupCanvas();
    const resizeObserver = new ResizeObserver(setupCanvas);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);
  
  useEffect(drawCanvas, [objects, selectedObjectId, interaction, editingText, viewTransform, snapGuides, canvasMode, cropRect]);

  useEffect(() => {
    const closeMenu = () => {
      setContextMenu(c => ({...c, visible: false}));
    };
    window.addEventListener('mousedown', closeMenu);
    return () => window.removeEventListener('mousedown', closeMenu);
  }, []);

  useEffect(() => {
      if (activeTool !== 'crop' || !cropRect) return;
  
      let ratio = 0;
      if (cropAspectRatio === '1:1') ratio = 1;
      else if (cropAspectRatio === '4:3') ratio = 4 / 3;
      else if (cropAspectRatio === '16:9') ratio = 16 / 9;
  
      if (ratio > 0) {
          const currentRect = { ...cropRect };
          const w = Math.abs(currentRect.width);
          const h = Math.abs(currentRect.height);
          const centerX = currentRect.x + currentRect.width / 2;
          const centerY = currentRect.y + currentRect.height / 2;
          
          let newWidth = w;
          let newHeight = h;
  
          if (w / h > ratio) {
              newWidth = h * ratio;
          } else {
              newHeight = w / ratio;
          }
  
          onCropRectChange({
              ...currentRect,
              x: centerX - newWidth / 2,
              y: centerY - newHeight / 2,
              width: newWidth,
              height: newHeight
          });
      }
  }, [cropAspectRatio]);

  useEffect(() => {
    if (activeTool === 'crop') {
        const canvas = canvasRef.current;
        if (canvas) {
            if (canvasMode === 'edit') {
                const imageObject = objects.find(o => o.type === 'image') as ImageObject | undefined;
                if (imageObject) {
                    onCropRectChange({
                        id: 'crop-rect', type: 'rect',
                        x: imageObject.x, y: imageObject.y,
                        width: imageObject.width, height: imageObject.height,
                        strokeColor: '#fff', strokeWidth: 1, rotation: 0,
                    });
                    return; // Done
                }
            }
            
            // Fallback for canvas mode or if no image in edit mode
            const viewWidth = canvas.width / (window.devicePixelRatio || 1) / viewTransform.scale;
            const viewHeight = canvas.height / (window.devicePixelRatio || 1) / viewTransform.scale;
            const canvasX = -viewTransform.offsetX / viewTransform.scale;
            const canvasY = -viewTransform.offsetY / viewTransform.scale;

            const initialWidth = viewWidth * 0.8;
            const initialHeight = viewHeight * 0.8;
            const initialX = canvasX + (viewWidth - initialWidth) / 2;
            const initialY = canvasY + (viewHeight - initialHeight) / 2;

            onCropRectChange({
                id: 'crop-rect', type: 'rect',
                x: initialX, y: initialY,
                width: initialWidth, height: initialHeight,
                strokeColor: '#fff', strokeWidth: 1, rotation: 0,
            });
        }
    } else {
        onCropRectChange(null);
    }
  }, [activeTool, canvasMode, objects, viewTransform, onCropRectChange]);


  const getObjectAtPosition = (x: number, y: number): CanvasObjectType | null => {
    const backgroundImage = canvasMode === 'edit' ? objects.find(o => o.type === 'image') : null;
    
    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (obj.visible === false) continue;
        if (backgroundImage && obj.id === backgroundImage.id) continue;

        const rotation = 'rotation' in obj ? obj.rotation : 0;
        if (rotation !== 0 && 'width' in obj && 'height' in obj) {
            const centerX = obj.x + obj.width / 2;
            const centerY = obj.y + obj.height / 2;
            const dx = x - centerX;
            const dy = y - centerY;
            const angleRad = -rotation * Math.PI / 180;
            const rotatedX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
            const rotatedY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
            if (Math.abs(rotatedX) <= obj.width / 2 && Math.abs(rotatedY) <= obj.height / 2) {
                return obj;
            }
        } else {
             if (obj.type === 'line') {
                const { x1, y1, x2, y2, strokeWidth } = obj;
                const tolerance = (strokeWidth / 2 + 5) / viewTransform.scale;
                const lenSq = (x2 - x1) ** 2 + (y2 - y1) ** 2;
                if (lenSq === 0) {
                    if (Math.hypot(x - x1, y - y1) < tolerance) return obj;
                } else {
                    let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lenSq;
                    t = Math.max(0, Math.min(1, t));
                    const nearestX = x1 + t * (x2 - x1);
                    const nearestY = y1 + t * (y2 - y1);
                    if (Math.hypot(x - nearestX, y - nearestY) < tolerance) return obj;
                }
            } else if (obj.type === 'image' || obj.type === 'rect' || obj.type === 'text') {
                if (x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height) {
                    return obj;
                }
            }
        }
    }
    return null;
  };
  
  const getHandleAtPosition = (x: number, y: number, obj: CanvasObjectType | RectObject) => {
    if (obj.type === 'line') {
      const handleHitboxSize = RESIZE_HANDLE_SIZE / viewTransform.scale;
      if (Math.hypot(x - obj.x1, y - obj.y1) < handleHitboxSize) return 'start';
      if (Math.hypot(x - obj.x2, y - obj.y2) < handleHitboxSize) return 'end';
      return null;
    }
    if (obj.type !== 'image' && obj.type !== 'rect' && obj.type !== 'text') return null;
    
    const { x: objX, y: objY, width, height } = obj;
    const rotation = 'rotation' in obj ? obj.rotation : 0;
    const centerX = objX + width / 2;
    const centerY = objY + height / 2;

    const point = {x, y};
    const rotatedPoint = {
        x: Math.cos(-rotation * Math.PI / 180) * (point.x - centerX) - Math.sin(-rotation * Math.PI / 180) * (point.y - centerY) + centerX,
        y: Math.sin(-rotation * Math.PI / 180) * (point.x - centerX) + Math.cos(-rotation * Math.PI / 180) * (point.y - centerY) + centerY
    };
    
    const handleHitboxSize = (RESIZE_HANDLE_SIZE * 2) / viewTransform.scale;

    const handles = {
        topLeft: { x: objX, y: objY }, topRight: { x: objX + width, y: objY },
        bottomLeft: { x: objX, y: objY + height }, bottomRight: { x: objX + width, y: objY + height },
    };
    
    // Check for resize handles
    const midHandles = {
        top: { x: objX + width / 2, y: objY }, bottom: { x: objX + width / 2, y: objY + height },
        left: { x: objX, y: objY + height / 2 }, right: { x: objX + width, y: objY + height / 2 },
    }

    for (const [name, pos] of Object.entries({...handles, ...midHandles})) {
        if (Math.hypot(pos.x - rotatedPoint.x, pos.y - rotatedPoint.y) < handleHitboxSize) {
            return name;
        }
    }
    
    // Check for dedicated rotation handle
    if ('rotation' in obj) {
        const rotHandleOffset = ROTATION_HANDLE_OFFSET / viewTransform.scale;
        const rotationHandleX = objX + width / 2;
        const rotationHandleY = objY - rotHandleOffset;
        if (Math.hypot(rotationHandleX - rotatedPoint.x, rotationHandleY - rotatedPoint.y) < handleHitboxSize) {
            return 'rotate';
        }
    }

    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setSnapGuides([]);
    setContextMenu({ visible: false, x: 0, y: 0, targetImage: null });
    const { clientX, clientY } = e;
    const { x: canvasX, y: canvasY } = getCanvasCoords(clientX, clientY);

    if (e.altKey && e.button === 2 && ['brush', 'eraser', 'ai_eraser'].includes(activeTool)) {
      e.preventDefault();
      setInteraction({ type: 'adjusting_brush', startX: clientX, startY: clientY, originalWidth: strokeWidth, originalOpacity: opacity, clientX, clientY });
      return;
    }
    if (e.button === 1) { // Middle mouse button
        e.preventDefault();
        setInteraction({ type: 'panning', startX: clientX, startY: clientY, startOffsetX: viewTransform.offsetX, startOffsetY: viewTransform.offsetY });
        return;
    }
    if (e.button !== 0) return;

    if (isSpacebarDown) {
        setInteraction({ type: 'panning', startX: clientX, startY: clientY, startOffsetX: viewTransform.offsetX, startOffsetY: viewTransform.offsetY });
        return;
    }

    if (activeTool === 'crop') {
        if (cropRect) {
            const handle = getHandleAtPosition(canvasX, canvasY, cropRect);
            if (handle) {
                const normalizedRect = { ...cropRect };
                if (normalizedRect.width < 0) {
                    normalizedRect.x += normalizedRect.width;
                    normalizedRect.width = Math.abs(normalizedRect.width);
                }
                if (normalizedRect.height < 0) {
                    normalizedRect.y += normalizedRect.height;
                    normalizedRect.height = Math.abs(normalizedRect.height);
                }
                setInteraction({ type: 'resizing_crop', handle, startX: canvasX, startY: canvasY, originalRect: normalizedRect });
                return;
            }
            if (canvasX >= cropRect.x && canvasX <= cropRect.x + cropRect.width && canvasY >= cropRect.y && canvasY <= cropRect.y + cropRect.height) {
                setInteraction({ type: 'moving_crop', startX: canvasX, startY: canvasY, originalRect: cropRect });
                return;
            }
        }
        // If click is not on a handle or inside the rect, do nothing.
        return;
    }
    
    if (activeTool === 'send') {
        const selectedObject = objects.find(o => o.id === selectedObjectId);
        if (selectedObject) {
            const handle = getHandleAtPosition(canvasX, canvasY, selectedObject);
            if (handle && (handle.startsWith('rotate') || handle === 'rotate')) {
                if (selectedObject.type === 'image' || selectedObject.type === 'rect' || selectedObject.type === 'text') {
                    const centerX = selectedObject.x + selectedObject.width / 2;
                    const centerY = selectedObject.y + selectedObject.height / 2;
                    const startAngle = Math.atan2(canvasY - centerY, canvasX - centerX) * 180 / Math.PI;
                    setInteraction({ type: 'rotating', objectId: selectedObjectId!, centerX, centerY, startAngle, originalRotation: selectedObject.rotation });
                    return;
                }
            }
            if (handle) {
                setInteraction({ type: 'resizing', objectId: selectedObjectId!, handle, startX: canvasX, startY: canvasY, originalObject: selectedObject as ImageObject | RectObject | TextObject | LineObject });
                return;
            }
        }

        const objectUnderMouse = getObjectAtPosition(canvasX, canvasY);
        if (objectUnderMouse) {
            setSelectedObjectId(objectUnderMouse.id);
            setInteraction({ type: 'moving', objectId: objectUnderMouse.id, startX: canvasX, startY: canvasY, originalObject: objectUnderMouse });
        } else {
            setSelectedObjectId(null);
        }
    } else if (['brush', 'rect', 'line', 'eraser', 'text', 'ai_eraser'].includes(activeTool)) {
      // IMPROVED: Ensure exact coordinates for anchor point
      // canvasX, canvasY are already transformed coordinates accounting for zoom/pan
      let tempObject;
      const id = `${activeTool}-${Date.now()}`;
      switch(activeTool) {
        case 'brush':
        case 'ai_eraser':
          // Use exact canvas coordinates for first point
          tempObject = { id, type: 'path', points: [{x: canvasX, y: canvasY}], strokeColor: strokeColor, strokeWidth: strokeWidth, opacity, visible: true };
          break;
        case 'eraser':
          // Use exact canvas coordinates for eraser
          tempObject = { id, type: 'path', points: [{x: canvasX, y: canvasY}], strokeColor: '#000000', strokeWidth: strokeWidth, opacity: 1, visible: true };
          break;
        case 'rect':
        case 'text':
          tempObject = { id, type: 'rect', x: canvasX, y: canvasY, width: 0, height: 0, strokeColor, strokeWidth, fillColor, opacity, visible: true, rotation: 0 };
          break;
        case 'line':
          tempObject = { id, type: 'line', x1: canvasX, y1: canvasY, x2: canvasX, y2: canvasY, strokeColor: strokeColor, strokeWidth: strokeWidth, opacity, visible: true };
          break;
      }
      setInteraction({ type: 'drawing', tool: activeTool as any, startX: canvasX, startY: canvasY, clientX, clientY, tempObject });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { clientX, clientY } = e;
    const { x: canvasX, y: canvasY } = getCanvasCoords(clientX, clientY);

    // FIXED: For brush/eraser tools, skip object detection to prevent cursor override
    let objectUnderMouse: CanvasObjectType | null = null;
    let handle: string | null = null;
    
    // Only check for objects/handles if NOT using drawing tools
    if (!['brush', 'eraser', 'ai_eraser'].includes(activeTool)) {
        const selectedObject = objects.find(o => o.id === selectedObjectId);
        objectUnderMouse = getObjectAtPosition(canvasX, canvasY);
        
        if (activeTool === 'crop' && cropRect) {
            const normalizedRect = { ...cropRect };
            if (normalizedRect.width < 0) {
                normalizedRect.x += normalizedRect.width;
                normalizedRect.width = Math.abs(normalizedRect.width);
            }
            if (normalizedRect.height < 0) {
                normalizedRect.y += normalizedRect.height;
                normalizedRect.height = Math.abs(normalizedRect.height);
            }
            handle = getHandleAtPosition(canvasX, canvasY, normalizedRect);
        } else if (selectedObject) {
            handle = getHandleAtPosition(canvasX, canvasY, selectedObject);
        }
    }
    
    setCursor(getCursorStyle(activeTool, !!objectUnderMouse, handle, isSpacebarDown, interaction, strokeWidth, viewTransform.scale, strokeColor));
    
    if (interaction.type === 'adjusting_brush') {
      const dx = clientX - interaction.startX;
      const dy = clientY - interaction.startY;
      const newWidth = Math.max(1, Math.min(200, Math.round(interaction.originalWidth + dx)));
      const newOpacity = Math.max(0, Math.min(1, interaction.originalOpacity - dy / 200));
      setStrokeWidth(newWidth);
      setOpacity(newOpacity);
      setInteraction(prev => ({ ...prev, clientX, clientY }));
      return;
    }
    
    if (interaction.type === 'none') return;
    
    if (interaction.type === 'panning') {
        const dx = clientX - interaction.startX;
        const dy = clientY - interaction.startY;
        setViewTransform(prev => ({
            ...prev,
            offsetX: interaction.startOffsetX + dx,
            offsetY: interaction.startOffsetY + dy,
        }));
        return;
    }
    
    if (interaction.type === 'moving_crop') {
        const dx = canvasX - interaction.startX;
        const dy = canvasY - interaction.startY;
        onCropRectChange({
            ...interaction.originalRect,
            x: interaction.originalRect.x + dx,
            y: interaction.originalRect.y + dy,
        });
    } else if (interaction.type === 'resizing_crop') {
        const { handle, originalRect } = interaction;
    
        let newX = originalRect.x;
        let newY = originalRect.y;
        let newWidth = originalRect.width;
        let newHeight = originalRect.height;
    
        const rightEdge = originalRect.x + originalRect.width;
        const bottomEdge = originalRect.y + originalRect.height;

        // Determine new dimensions based on handle, without constraints first
        if (handle.includes('left')) {
            newX = canvasX;
            newWidth = rightEdge - canvasX;
        }
        if (handle.includes('right')) {
            newWidth = canvasX - originalRect.x;
        }
        if (handle.includes('top')) {
            newY = canvasY;
            newHeight = bottomEdge - canvasY;
        }
        if (handle.includes('bottom')) {
            newHeight = canvasY - originalRect.y;
        }
    
        let ratio = 0;
        if (cropAspectRatio === '1:1') ratio = 1;
        else if (cropAspectRatio === '4:3') ratio = 4 / 3;
        else if (cropAspectRatio === '16:9') ratio = 16 / 9;
    
        if (ratio > 0) {
            const isCorner = (handle.includes('top') || handle.includes('bottom')) && (handle.includes('left') || handle.includes('right'));
            
            if (isCorner) {
                const tempWidth = newWidth;
                const tempHeight = newHeight;
                
                if (Math.abs(tempWidth / ratio) > Math.abs(tempHeight)) {
                    // Width change is dominant
                    newHeight = tempWidth / ratio * Math.sign(tempHeight || 1);
                } else {
                    // Height change is dominant
                    newWidth = tempHeight * ratio * Math.sign(tempWidth || 1);
                }
    
                // Recalculate position based on anchored corner
                if (handle.includes('top')) {
                    newY = bottomEdge - newHeight;
                }
                if (handle.includes('left')) {
                    newX = rightEdge - newWidth;
                }
            } else { // Side handles
                if (handle.includes('left') || handle.includes('right')) {
                    const oldHeight = newHeight;
                    newHeight = newWidth / ratio * Math.sign(oldHeight || 1);
                    newY = originalRect.y + (originalRect.height - newHeight) / 2;
                } else { // Top or bottom handles
                    const oldWidth = newWidth;
                    newWidth = newHeight * ratio * Math.sign(oldWidth || 1);
                    newX = originalRect.x + (originalRect.width - newWidth) / 2;
                }
            }
        }
        
        onCropRectChange({ ...originalRect, x: newX, y: newY, width: newWidth, height: newHeight });
    } else if (interaction.type === 'moving') {
        const dx = canvasX - interaction.startX;
        const dy = canvasY - interaction.startY;
        
        const otherObjects = objects.filter(o => o.id !== interaction.objectId);
        const { originalObject } = interaction;
        
        let newX = 0, newY = 0;
        
        if ('x' in originalObject && 'y' in originalObject) {
            newX = originalObject.x + dx;
            newY = originalObject.y + dy;
            
            const movingBox = getObjectBoundingBox({ ...originalObject, x: newX, y: newY } as CanvasObjectType);

            if (movingBox) {
                const { snapAdjustment, guides } = getSnappingAndGuides(movingBox, otherObjects, viewTransform.scale);
                newX += snapAdjustment.x;
                newY += snapAdjustment.y;
                setSnapGuides(guides);
            }
        }
        
        setObjects(prev => prev.map(obj => {
            if (obj.id !== interaction.objectId) return obj;
            if (originalObject.type === 'line') {
                return { ...obj, x1: originalObject.x1 + dx, y1: originalObject.y1 + dy, x2: originalObject.x2 + dx, y2: originalObject.y2 + dy };
            }
            if ('x' in originalObject && 'y' in obj) {
                 return { ...obj, x: newX, y: newY };
            }
            return obj;
        }), false);
    } else if (interaction.type === 'resizing') {
        const { handle, startX, startY, originalObject } = interaction;

        if(originalObject.type === 'line') {
          setObjects(prev => prev.map(obj => {
              if (obj.id !== interaction.objectId) return obj;
              const line = obj as LineObject;
              if (handle === 'start') {
                  return { ...line, x1: canvasX, y1: canvasY };
              }
              if (handle === 'end') {
                  return { ...line, x2: canvasX, y2: canvasY };
              }
              return obj;
          }), false);
          return;
        }

        let newX = originalObject.x, newY = originalObject.y, newWidth = originalObject.width, newHeight = originalObject.height;
        const dx = canvasX - startX;
        const dy = canvasY - startY;

        if (originalObject.type === 'image' && (handle === 'topLeft' || handle === 'topRight' || handle === 'bottomLeft' || handle === 'bottomRight')) {
            const aspectRatio = originalObject.width / originalObject.height;
            let anchorX = 0, anchorY = 0;

            if (handle.includes('Left')) {
                anchorX = originalObject.x + originalObject.width;
            } else {
                anchorX = originalObject.x;
            }
            if (handle.includes('top')) {
                anchorY = originalObject.y + originalObject.height;
            } else {
                anchorY = originalObject.y;
            }
            
            let tempWidth = Math.abs(canvasX - anchorX);
            let tempHeight = Math.abs(canvasY - anchorY);
            
            if (tempWidth / aspectRatio > tempHeight) {
                newHeight = tempWidth / aspectRatio;
                newWidth = tempWidth;
            } else {
                newWidth = tempHeight * aspectRatio;
                newHeight = tempHeight;
            }

            if (newWidth < 10) {
                newWidth = 10;
                newHeight = newWidth / aspectRatio;
            }
            if (newHeight < 10) {
                newHeight = 10;
                newWidth = newHeight * aspectRatio;
            }

            if (handle.includes('left')) {
                newX = anchorX - newWidth;
            } else {
                newX = anchorX;
            }
            if (handle.includes('top')) {
                newY = anchorY - newHeight;
            } else {
                newY = anchorY;
            }

        } else {
            if (handle.includes('right')) newWidth = Math.max(10, originalObject.width + dx);
            if (handle.includes('left')) {
                const finalWidth = Math.max(10, originalObject.width - dx);
                newX = originalObject.x + originalObject.width - finalWidth;
                newWidth = finalWidth;
            }
            if (handle.includes('bottom')) newHeight = Math.max(10, originalObject.height + dy);
            if (handle.includes('top')) {
                const finalHeight = Math.max(10, originalObject.height - dy);
                newY = originalObject.y + originalObject.height - finalHeight;
                newHeight = finalHeight;
            }
        }
        
        const otherObjects = objects.filter(o => o.id !== interaction.objectId);
        const movingBox = { x: newX, y: newY, width: newWidth, height: newHeight };
        const { snapAdjustment, guides } = getSnappingAndGuides(movingBox, otherObjects, viewTransform.scale);
        setSnapGuides(guides);

        if (handle.includes('left')) {
            newX += snapAdjustment.x;
            newWidth -= snapAdjustment.x;
        } else if (handle.includes('right')) {
            newWidth += snapAdjustment.x;
        } else if (snapAdjustment.x !== 0) {
            newX += snapAdjustment.x;
        }
        
        if (handle.includes('top')) {
            newY += snapAdjustment.y;
            newHeight -= snapAdjustment.y;
        } else if (handle.includes('bottom')) {
            newHeight += snapAdjustment.y;
        } else if (snapAdjustment.y !== 0) {
            newY += snapAdjustment.y;
        }
        
        setObjects(prev => prev.map(obj => {
            if (obj.id !== interaction.objectId) return obj;
            
            const updatedObj = { ...obj, x: newX, y: newY, width: newWidth, height: newHeight };
        
            if (updatedObj.type === 'text') {
                return {
                    ...updatedObj,
                    fontSize: Math.max(12, Math.min(newWidth / 10, newHeight * 0.8))
                };
            }
            
            return updatedObj;
        }), false);

    } else if (interaction.type === 'rotating') {
        const currentAngle = Math.atan2(canvasY - interaction.centerY, canvasX - interaction.centerX) * 180 / Math.PI;
        let rotation = interaction.originalRotation + (currentAngle - interaction.startAngle);
        setObjects(prev => prev.map(obj => 
            obj.id === interaction.objectId ? { ...obj, rotation } as TextObject | ImageObject | RectObject : obj
        ), false);

    } else if (interaction.type === 'drawing') {
        let newTempObject = { ...interaction.tempObject };
        if (newTempObject.type === 'path') {
            newTempObject.points.push({ x: canvasX, y: canvasY });
        } else if (newTempObject.type === 'rect') {
            newTempObject.width = canvasX - interaction.startX;
            newTempObject.height = canvasY - interaction.startY;
        } else if (newTempObject.type === 'line') {
            newTempObject.x2 = canvasX;
            newTempObject.y2 = canvasY;
        }
        setInteraction({ ...interaction, clientX, clientY, tempObject: newTempObject });
    }
  };

  const handleMouseUp = async () => {
    setSnapGuides([]);
    
    if (interaction.type === 'drawing' && interaction.tool === 'eraser') {
        const selectedObject = objects.find(o => o.id === selectedObjectId);
        if (selectedObject) {
            const erasePath = interaction.tempObject as PathObject;
            if (erasePath.points.length > 1) {
                const newImageObject = await rasterizeAndErase(selectedObject, erasePath);
                setObjects(prev => prev.map(o => o.id === selectedObjectId ? newImageObject : o));
            }
        }
        setInteraction({ type: 'none' });
        return;
    }

    if (interaction.type === 'drawing' && interaction.tool === 'ai_eraser') {
      const finalObject = { ...interaction.tempObject } as PathObject;
      if (finalObject.points.length > 2) { // Need at least a small path
        onAIEraserFinish(finalObject);
      }
      setInteraction({ type: 'none' });
      return; 
    }
    
    if (interaction.type === 'moving_crop' || interaction.type === 'resizing_crop') {
        if (cropRect) {
            const finalRect = { ...cropRect };
            if (finalRect.width < 0) {
                finalRect.x = finalRect.x + finalRect.width;
                finalRect.width = Math.abs(finalRect.width);
            }
            if (finalRect.height < 0) {
                finalRect.y = finalRect.y + finalRect.height;
                finalRect.height = Math.abs(finalRect.height);
            }
            onCropRectChange(finalRect);
        }
        setInteraction({ type: 'none' });
        return;
    }

    if (interaction.type === 'moving' || interaction.type === 'resizing' || interaction.type === 'rotating') {
        setObjects(objects, true); // This will commit the final state to history
    }

    if (interaction.type === 'panning' || interaction.type === 'adjusting_brush') {
        setInteraction({ type: 'none' });
        return;
    }
    if (interaction.type === 'drawing') {
        const finalObject = { ...interaction.tempObject };

        if (interaction.tool === 'brush') {
          const path = finalObject as PathObject;
          if (path.points.length < 2) {
              setInteraction({ type: 'none' });
              return;
          }

          if (canvasMode === 'edit') {
            const targetImage = objects.find(o => o.type === 'image') as ImageObject | undefined;
            if (targetImage) {
                // Non-destructive: Just add the mask object. App.tsx will handle what to do with it.
                setObjects(prev => [...prev, path]);
                onOpenMaskPrompt(path.id, interaction.clientX, interaction.clientY);
            }
            setInteraction({ type: 'none' });
            return;
          }
          
          const underlyingImage = objects.slice().reverse().find(obj => {
              if (obj.type !== 'image') return false;
              return path.points.some(p => p.x >= obj.x && p.x <= obj.x + obj.width && p.y >= obj.y && p.y <= obj.y + obj.height);
          });
          
          setObjects(prev => [...prev, finalObject]);

          if (underlyingImage) {
              onOpenMaskPrompt(finalObject.id, interaction.clientX, interaction.clientY);
          }
      } else if (interaction.tool === 'line') {
            const line = finalObject as LineObject;
            const lineLength = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
            
            if (lineLength < 10) {
                setInteraction({ type: 'none' });
                return;
            }
            
            const start = { x: line.x1, y: line.y1 };
            const end = { x: line.x2, y: line.y2 };
            let angleDeg;

            if (line.x1 > line.x2) {
                const angleRad = Math.atan2(start.y - end.y, start.x - end.x);
                angleDeg = angleRad * 180 / Math.PI;
            } else {
                const angleRad = Math.atan2(end.y - start.y, end.x - start.x);
                angleDeg = angleRad * 180 / Math.PI;
            }
           
            const textWidth = lineLength;
            const textHeight = 30;
            const perpendicularOffset = -(textHeight / 2 + 5); 

            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const lineLengthEpsilon = lineLength > 0 ? lineLength : 1;
            const perpX = -dy / lineLengthEpsilon;
            const perpY = dx / lineLengthEpsilon;

            const textCenterX = midX + perpendicularOffset * perpX;
            const textCenterY = midY + perpendicularOffset * perpY;

            const textX = textCenterX - textWidth / 2;
            const textY = textCenterY - textHeight / 2;

            const textObject: TextObject = {
                id: `text-${Date.now()}`,
                type: 'text',
                x: textX,
                y: textY,
                width: textWidth,
                height: textHeight,
                text: 'Add label',
                strokeColor: line.strokeColor,
                fontSize: textFontSize,
                rotation: angleDeg,
                align: textAlign,
                visible: true,
            };
            
            setObjects(prev => [...prev, line, textObject]);
            setSelectedObjectId(textObject.id);
            onTextDoubleClick(textObject);
            setActiveTool('send');

        } else if (finalObject.type === 'rect') {
            if (finalObject.width < 0) {
              finalObject.x = finalObject.x + finalObject.width;
              finalObject.width = Math.abs(finalObject.width);
            }
            if (finalObject.height < 0) {
              finalObject.y = finalObject.y + finalObject.height;
              finalObject.height = Math.abs(finalObject.height);
            }
    
            if (interaction.tool === 'text') {
                if (finalObject.width < 20 || finalObject.height < 20) {
                    setInteraction({type: 'none'});
                    return;
                }
                const textObject: TextObject = {
                    id: finalObject.id,
                    type: 'text',
                    x: finalObject.x,
                    y: finalObject.y,
                    width: finalObject.width,
                    height: finalObject.height,
                    text: 'Double click to edit',
                    strokeColor: finalObject.strokeColor,
                    fontSize: textFontSize,
                    rotation: 0,
                    align: textAlign,
                    visible: true,
                };
                setObjects(prev => [...prev, textObject]);
                setSelectedObjectId(textObject.id);
                onTextDoubleClick(textObject);
                setActiveTool('send');
            } else {
                 setObjects(prev => [...prev, finalObject]);
            }
        } else {
            setObjects(prev => [...prev, finalObject]);
        }
    }
    setInteraction({ type: 'none' });
  };
  
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { clientX, clientY } = e;
      const { x: canvasX, y: canvasY } = getCanvasCoords(clientX, clientY);
      const object = getObjectAtPosition(canvasX, canvasY);
      if(object && object.type === 'text') {
          setSelectedObjectId(object.id);
          onTextDoubleClick(object);
      }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();

    const stagedAssetSrc = e.dataTransfer.getData('application/x-staged-asset-src');
    if (stagedAssetSrc) {
        const { x: canvasX, y: canvasY } = getCanvasCoords(e.clientX, e.clientY);
        const img = new Image();
        img.onload = () => {
            const newImage: ImageObject = {
                id: `image-${Date.now()}`,
                type: 'image',
                src: stagedAssetSrc,
                x: canvasX - img.width / 2,
                y: canvasY - img.height / 2,
                width: img.width,
                height: img.height,
                visible: true,
                rotation: 0,
            };
            setObjects(prev => [...prev, newImage]);
            setSelectedObjectId(newImage.id);
        };
        img.src = stagedAssetSrc;
        return;
    }

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                onImageDrop(reader.result);
            }
        };
        reader.readAsDataURL(file);
    }
  };
  
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { clientX, clientY, deltaY } = e;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    const zoomFactor = 1.1;
    const oldScale = viewTransform.scale;
    const newScale = deltaY < 0 ? oldScale * zoomFactor : oldScale / zoomFactor;
    const clampedScale = Math.max(0.1, Math.min(10, newScale));

    const newOffsetX = mouseX - (mouseX - viewTransform.offsetX) * (clampedScale / oldScale);
    const newOffsetY = mouseY - (mouseY - viewTransform.offsetY) * (clampedScale / oldScale);
    
    setViewTransform({ scale: clampedScale, offsetX: newOffsetX, offsetY: newOffsetY });
  };

  const distToSegmentSquared = (p: {x:number, y:number}, a: {x:number, y:number}, b: {x:number, y:number}) => {
    const l2 = (b.x - a.x)**2 + (b.y - a.y)**2;
    if (l2 === 0) return (p.x - a.x)**2 + (p.y - a.y)**2;
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const closestX = a.x + t * (b.x - a.x);
    const closestY = a.y + t * (b.y - a.y);
    return (p.x - closestX)**2 + (p.y - closestY)**2;
  }

  const getPathObjectAtPosition = (x: number, y: number): PathObject | null => {
      for (let i = objects.length - 1; i >= 0; i--) {
          const obj = objects[i];
          if (obj.visible === false || obj.type !== 'path') continue;

          const tolerance = (obj.strokeWidth / 2 + 5 / viewTransform.scale);
          const toleranceSq = tolerance * tolerance;
          
          for (let j = 0; j < obj.points.length - 1; j++) {
              const p1 = obj.points[j];
              const p2 = obj.points[j+1];
              if (distToSegmentSquared({x, y}, p1, p2) < toleranceSq) {
                  return obj;
              }
          }
      }
      return null;
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (e.altKey && ['brush', 'eraser', 'ai_eraser'].includes(activeTool)) {
          return;
      }
      
      const { clientX, clientY } = e;
      const { x: canvasX, y: canvasY } = getCanvasCoords(clientX, clientY);

      if (canvasMode === 'edit') {
        const bgImage = objects.find(o => o.type === 'image') as ImageObject | undefined;
        if (bgImage && canvasX >= bgImage.x && canvasX <= bgImage.x + bgImage.width && canvasY >= bgImage.y && canvasY <= bgImage.y + bgImage.height) {
          setContextMenu({ visible: true, x: clientX, y: clientY, targetImage: bgImage });
          return;
        }
      }
      
      const object = getPathObjectAtPosition(canvasX, canvasY);
      if (object) {
          onOpenMaskPrompt(object.id, clientX, clientY);
      }
  }

  return (
    <div 
        ref={containerRef} 
        className={`w-full h-full rounded-lg shadow-lg overflow-hidden ${canvasMode === 'canvas' ? 'bg-white' : 'bg-transparent'}`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        style={{ cursor: cursor }}
      />
      {contextMenu.visible && contextMenu.targetImage && (
        <ImageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          targetImage={contextMenu.targetImage}
          onClose={() => setContextMenu({ visible: false, x: 0, y: 0, targetImage: null })}
        />
      )}
    </div>
  );
};

export default Canvas;