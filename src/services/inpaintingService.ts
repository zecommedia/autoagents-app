/**
 * Inpainting Service
 * Migrated from AutoAgents-Redesign for full inpainting functionality
 */
import type { ImageObject, PathObject } from '../types';
import { dataUrlToPart } from "./geminiService";
import { cloudApiService } from '../../lib/services/cloudApiService';

/**
 * Gets a text description of the content within the masked area of an image.
 * Uses cloud API instead of direct Gemini API call.
 * @param targetImage The original background image.
 * @param maskObject The path defining the mask.
 * @returns A promise resolving to a string description, or an empty string if it fails.
 */
export const describeMaskedArea = async (
    targetImage: ImageObject,
    maskObject: PathObject
): Promise<string> => {
    try {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        const imageLoadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
            img.onload = () => resolve(img);
            img.onerror = reject;
        });
        img.src = targetImage.src;
        await imageLoadPromise;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';
        
        const maskBbox = {
            minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity,
        };
        maskObject.points.forEach(p => {
            maskBbox.minX = Math.min(maskBbox.minX, p.x);
            maskBbox.minY = Math.min(maskBbox.minY, p.y);
            maskBbox.maxX = Math.max(maskBbox.maxX, p.x);
            maskBbox.maxY = Math.max(maskBbox.maxY, p.y);
        });
        const halfStroke = (maskObject.strokeWidth || 20) / 2;

        const scaleX = img.naturalWidth / targetImage.width;
        const scaleY = img.naturalHeight / targetImage.height;

        const crop = {
            x: (maskBbox.minX - halfStroke - targetImage.x) * scaleX,
            y: (maskBbox.minY - halfStroke - targetImage.y) * scaleY,
            width: (maskBbox.maxX - maskBbox.minX + maskObject.strokeWidth) * scaleX,
            height: (maskBbox.maxY - maskBbox.minY + maskObject.strokeWidth) * scaleY,
        };
        
        canvas.width = crop.width;
        canvas.height = crop.height;
        ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
        
        const croppedImageDataUrl = canvas.toDataURL('image/jpeg');
        
        // Use cloud API instead of direct Gemini call
        const imagePart = await dataUrlToPart(croppedImageDataUrl);
        const prompt = "Briefly describe the main subject in this image in a few words.";
        
        // Call cloud API for image description
        const result = await cloudApiService.request({
            endpoint: '/proxy/gemini',
            data: {
                parts: [imagePart, { text: prompt }],
                generationConfig: { temperature: 0.4 }
            }
        });

        if (result.success && result.data?.text) {
            return result.data.text.trim();
        }

        return ""; // Return empty string on failure

    } catch (error) {
        console.error("Failed to describe masked area:", error);
        return ""; // Return empty string on failure, allowing the main process to continue
    }
}

/**
 * Creates a new image by punching a transparent hole in the target image
 * based on the free-form path of the mask object.
 * @param targetImage The background image object.
 * @param maskObject The path object used as a mask.
 * @returns A promise that resolves to the data URL of the masked image.
 */
export const createMaskedImage = (
    targetImage: ImageObject,
    maskObject: PathObject,
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = targetImage.src;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context.'));
            }

            // Draw the original image
            ctx.drawImage(img, 0, 0);

            // Set up scaling factors to translate canvas coordinates to image coordinates
            const scaleX = img.naturalWidth / targetImage.width;
            const scaleY = img.naturalHeight / targetImage.height;

            // "Punch a hole" by drawing the path with destination-out
            ctx.globalCompositeOperation = 'destination-out';
            
            // Set up the brush properties for the mask path
            ctx.strokeStyle = 'black'; // Color is irrelevant for destination-out
            ctx.lineWidth = maskObject.strokeWidth * Math.min(scaleX, scaleY); // Scale stroke width
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Draw the mask path
            ctx.beginPath();
            if (maskObject.points.length > 0) {
                // Translate points from canvas space to image space
                const startPoint = maskObject.points[0];
                const imgStartX = (startPoint.x - targetImage.x) * scaleX;
                const imgStartY = (startPoint.y - targetImage.y) * scaleY;
                ctx.moveTo(imgStartX, imgStartY);

                maskObject.points.forEach(point => {
                    const imgPointX = (point.x - targetImage.x) * scaleX;
                    const imgPointY = (point.y - targetImage.y) * scaleY;
                    ctx.lineTo(imgPointX, imgPointY);
                });
            }
            ctx.stroke(); // Stroke the path to create the erased area

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (err) => reject(new Error(`Image load error during masking: ${err}`));
    });
};

/**
 * Creates a black and white mask image from a path object relative to a target image.
 * The mask is white on a black background.
 * @param targetImage The background image object to determine dimensions.
 * @param maskObject The path object to draw as the mask.
 * @returns A promise that resolves to the data URL of the mask image.
 */
export const createBWMaskImage = (
    targetImage: ImageObject,
    maskObject: PathObject,
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = targetImage.src;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context.'));
            }

            // Black background
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Set up scaling factors
            const scaleX = img.naturalWidth / targetImage.width;
            const scaleY = img.naturalHeight / targetImage.height;

            // Set up brush properties for the mask path
            ctx.strokeStyle = 'white'; // White brush on black background
            ctx.lineWidth = maskObject.strokeWidth * Math.min(scaleX, scaleY);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Draw the mask path
            ctx.beginPath();
            if (maskObject.points.length > 0) {
                const startPoint = maskObject.points[0];
                const imgStartX = (startPoint.x - targetImage.x) * scaleX;
                const imgStartY = (startPoint.y - targetImage.y) * scaleY;
                ctx.moveTo(imgStartX, imgStartY);

                maskObject.points.forEach(point => {
                    const imgPointX = (point.x - targetImage.x) * scaleX;
                    const imgPointY = (point.y - targetImage.y) * scaleY;
                    ctx.lineTo(imgPointX, imgPointY);
                });
            }
            ctx.stroke();

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (err) => reject(new Error(`Image load error during mask creation: ${err}`));
    });
};

/**
 * Crops a rectangular area from a target image based on the bounding box of a mask path.
 * @param targetImage The source image object.
 * @param maskObject The path object defining the area of interest.
 * @returns A promise that resolves to the data URL of the cropped image.
 */
export const cropImageByMask = (
    targetImage: ImageObject,
    maskObject: PathObject,
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = targetImage.src;

        img.onload = () => {
            // Determine the bounding box of the mask path
            const bbox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
            maskObject.points.forEach(p => {
                bbox.minX = Math.min(bbox.minX, p.x);
                bbox.minY = Math.min(bbox.minY, p.y);
                bbox.maxX = Math.max(bbox.maxX, p.x);
                bbox.maxY = Math.max(bbox.maxY, p.y);
            });
            const halfStroke = (maskObject.strokeWidth || 20) / 2;
            
            // Convert canvas coordinates to source image pixel coordinates
            const scaleX = img.naturalWidth / targetImage.width;
            const scaleY = img.naturalHeight / targetImage.height;

            const sx = (bbox.minX - halfStroke - targetImage.x) * scaleX;
            const sy = (bbox.minY - halfStroke - targetImage.y) * scaleY;
            const sWidth = (bbox.maxX - bbox.minX + maskObject.strokeWidth) * scaleX;
            const sHeight = (bbox.maxY - bbox.minY + maskObject.strokeWidth) * scaleY;

            // Create a new canvas with the dimensions of the cropped area
            const canvas = document.createElement('canvas');
            canvas.width = sWidth;
            canvas.height = sHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context for cropping.'));
            }

            // Draw the cropped portion of the source image onto the new canvas
            ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

            resolve(canvas.toDataURL('image/png'));
        };

        img.onerror = (err) => reject(new Error(`Image load error during cropping: ${err}`));
    });
};
