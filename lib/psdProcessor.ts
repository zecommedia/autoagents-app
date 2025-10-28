/**
 * Client-Side PSD Processor
 * 
 * Processes PSD files entirely in the browser using ag-psd.
 * No server calls required - 100% local processing.
 * 
 * Features:
 * - Read PSD files
 * - Find "REPLACE" Smart Object layers
 * - Replace Smart Object content with POD design
 * - Export to PNG
 * - All processing happens in browser memory
 */

import { readPsd, Psd } from 'ag-psd';

export interface PsdProcessResult {
    filename: string;
    data: string; // Base64 data URL
}

/**
 * Process a single PSD file with POD design
 * @param podDesignFile - The POD design image file
 * @param psdFile - The PSD mockup template file
 * @returns Base64 PNG data URL
 */
export async function processPsdClientSide(
    podDesignFile: File,
    psdFile: File
): Promise<PsdProcessResult> {
    console.log(`Processing ${psdFile.name} client-side with ag-psd...`);

    // 1. Read PSD file
    const psdBuffer = await psdFile.arrayBuffer();
    const psd = readPsd(new Uint8Array(psdBuffer), {
        skipCompositeImageData: false, // We need the composite
        skipLayerImageData: false,
        skipThumbnail: true
    });

    if (!psd) {
        throw new Error(`Failed to read PSD: ${psdFile.name}`);
    }

    console.log(`PSD dimensions: ${psd.width}x${psd.height}`);
    console.log(`PSD has ${psd.children?.length || 0} top-level layers`);

    // 2. Find "REPLACE" layer bounds
    const replaceLayer = findLayerRecursive(psd.children, 'REPLACE');
    
    let layerBounds: { left: number; top: number; right: number; bottom: number };
    
    if (replaceLayer) {
        console.log(`✓ Found REPLACE layer at:`, {
            left: replaceLayer.left,
            top: replaceLayer.top,
            right: replaceLayer.right,
            bottom: replaceLayer.bottom
        });
        
        layerBounds = {
            left: replaceLayer.left || 0,
            top: replaceLayer.top || 0,
            right: replaceLayer.right || psd.width,
            bottom: replaceLayer.bottom || psd.height
        };
    } else {
        console.warn(`⚠️ No REPLACE layer found, using center placement`);
        // Fallback: center placement (40% of canvas width)
        const stickerSize = Math.floor(psd.width * 0.4);
        const centerX = Math.floor((psd.width - stickerSize) / 2);
        const centerY = Math.floor((psd.height - stickerSize) / 2);
        
        layerBounds = {
            left: centerX,
            top: centerY,
            right: centerX + stickerSize,
            bottom: centerY + stickerSize
        };
    }

    const layerWidth = layerBounds.right - layerBounds.left;
    const layerHeight = layerBounds.bottom - layerBounds.top;
    console.log(`Layer dimensions: ${layerWidth}x${layerHeight}`);

    // 3. Load POD design image
    const podDesignDataUrl = await fileToDataUrl(podDesignFile);
    const podImage = await loadImage(podDesignDataUrl);
    console.log(`POD design loaded: ${podImage.width}x${podImage.height}`);

    // 4. Create canvas for compositing
    const canvas = document.createElement('canvas');
    canvas.width = psd.width;
    canvas.height = psd.height;
    const ctx = canvas.getContext('2d', { alpha: true });
    
    if (!ctx) {
        throw new Error('Failed to get canvas context');
    }

    // 5. Draw PSD composite as base
    if (psd.canvas) {
        // ag-psd already rendered it
        ctx.drawImage(psd.canvas as any, 0, 0);
        console.log(`✓ Drew PSD composite from canvas`);
    } else if (psd.imageData) {
        // Render from imageData
        const imageData = ctx.createImageData(psd.width, psd.height);
        const psdData = psd.imageData.data;
        imageData.data.set(psdData);
        ctx.putImageData(imageData, 0, 0);
        console.log(`✓ Drew PSD composite from imageData`);
    } else {
        throw new Error('PSD has no composite image data');
    }

    // 6. Resize and composite POD design onto PSD at layer position
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = layerWidth;
    tempCanvas.height = layerHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (!tempCtx) {
        throw new Error('Failed to get temp canvas context');
    }

    // Draw POD design scaled to fit layer bounds (contain mode)
    const scale = Math.min(
        layerWidth / podImage.width,
        layerHeight / podImage.height
    );
    const scaledWidth = podImage.width * scale;
    const scaledHeight = podImage.height * scale;
    const offsetX = (layerWidth - scaledWidth) / 2;
    const offsetY = (layerHeight - scaledHeight) / 2;

    tempCtx.drawImage(
        podImage,
        offsetX,
        offsetY,
        scaledWidth,
        scaledHeight
    );

    // Composite temp canvas onto main canvas at layer position
    ctx.drawImage(
        tempCanvas,
        layerBounds.left,
        layerBounds.top,
        layerWidth,
        layerHeight
    );

    console.log(`✓ Composited POD design at (${layerBounds.left}, ${layerBounds.top})`);

    // 7. Export to PNG as data URL
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    console.log(`✓ Exported PNG (${Math.round(dataUrl.length / 1024)}KB)`);

    return {
        filename: psdFile.name.replace(/\.psd$/i, '_processed.png'),
        data: dataUrl
    };
}

/**
 * Process multiple PSD files in parallel
 */
export async function processPsdsClientSide(
    podDesignFile: File,
    psdFiles: File[]
): Promise<PsdProcessResult[]> {
    console.log(`Processing ${psdFiles.length} PSDs client-side...`);
    
    // Process all PSDs in parallel
    const results = await Promise.all(
        psdFiles.map(psdFile => processPsdClientSide(podDesignFile, psdFile))
    );
    
    console.log(`✓ Processed ${results.length} PSDs successfully`);
    return results;
}

/**
 * Recursively find a layer by name (case-insensitive)
 */
function findLayerRecursive(
    layers: any[] | undefined,
    targetName: string
): any | null {
    if (!layers) return null;

    for (const layer of layers) {
        // Check if this layer matches
        if (layer.name && layer.name.toUpperCase() === targetName.toUpperCase()) {
            return layer;
        }

        // Recursively search children
        if (layer.children && layer.children.length > 0) {
            const found = findLayerRecursive(layer.children, targetName);
            if (found) return found;
        }
    }

    return null;
}

/**
 * Convert File to Data URL
 */
function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                resolve(event.target.result as string);
            } else {
                reject(new Error('Failed to read file'));
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

/**
 * Load image from data URL
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataUrl;
    });
}
